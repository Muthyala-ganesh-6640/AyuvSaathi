import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";
import type { HealthcareConnection, AuditLogEntry, AppNotification } from "@/lib/db/types";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);

    // Only authorized professionals can resolve a patient QR
    if (!user.role || user.role === "patient") {
      return jsonError("Only authorized healthcare professionals (Doctor, Lab Tech, Pharmacist) can resolve patient QR codes.", 403);
    }

    const body = await request.json().catch(() => ({}));
    const { token } = body;
    if (!token || typeof token !== "string") {
      return jsonError("Valid QR token is required", 400);
    }

    // Clean token string if full URI is passed
    const cleanToken = token.startsWith("ayuv://connect/t/")
      ? token.replace("ayuv://connect/t/", "")
      : token;

    const qrRecord = await store.getQRToken(cleanToken);
    if (!qrRecord) {
      return jsonError("QR code is expired, revoked, or invalid. Please ask the patient to generate a new QR.", 404);
    }

    // Resolve patient profile
    let patientName = qrRecord.patientName;
    let ayuvSaathiId = qrRecord.ayuvSaathiId;
    let relationship = "self";
    let emergencyContact: string | undefined;
    let bloodGroup: string | undefined;

    if (qrRecord.patientProfileId !== qrRecord.primaryUserId) {
      const fam = await store.getFamilyMember(qrRecord.patientProfileId);
      if (fam) {
        patientName = fam.name;
        ayuvSaathiId = fam.ayuvSaathiId;
        relationship = fam.relationship;
        emergencyContact = fam.emergencyContact;
        bloodGroup = fam.bloodGroup;
      }
    } else {
      const primaryUser = await store.getProfile(qrRecord.primaryUserId);
      if (primaryUser) {
        patientName = primaryUser.displayName;
        ayuvSaathiId = primaryUser.ayuvSaathiId || ayuvSaathiId;
      }
    }

    // Create or update connection
    const existingConn = await store.findConnection(qrRecord.patientProfileId, user.id);
    const orgName =
      user.doctorProfile?.hospitalClinicName ||
      user.labTechProfile?.labName ||
      user.pharmacistProfile?.pharmacyName ||
      "Healthcare Center";

    const connection: HealthcareConnection = {
      id: existingConn?.id || crypto.randomUUID(),
      patientProfileId: qrRecord.patientProfileId,
      primaryUserId: qrRecord.primaryUserId,
      professionalId: user.id,
      professionalRole: user.role,
      professionalName: user.displayName,
      specialization: user.doctorProfile?.specialization || user.labTechProfile?.specialization,
      organizationName: orgName,
      department: user.doctorProfile?.department || user.labTechProfile?.department,
      contactNumber: user.doctorProfile?.contactNumber || user.labTechProfile?.contactNumber || user.pharmacistProfile?.contactNumber,
      status: "active",
      permissions: {
        viewRecords: user.role === "doctor",
        viewPrescriptions: user.role === "doctor" || user.role === "pharmacist",
        createPrescription: user.role === "doctor",
        uploadReports: user.role === "lab_tech",
        dispenseMedicines: user.role === "pharmacist",
      },
      lastInteractionAt: new Date().toISOString(),
      createdAt: existingConn?.createdAt || new Date().toISOString(),
    };
    await store.saveConnection(connection);

    // Audit log
    const auditEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      actorId: user.id,
      actorRole: user.role,
      actorName: user.displayName,
      patientProfileId: qrRecord.patientProfileId,
      action: "qr_scanned",
      details: {
        professionalRole: user.role,
        organization: orgName,
        connectionId: connection.id,
      },
      timestamp: new Date().toISOString(),
    };
    await store.logAudit(auditEntry);

    // Notify patient
    const notification: AppNotification = {
      id: crypto.randomUUID(),
      userId: qrRecord.primaryUserId,
      patientProfileId: qrRecord.patientProfileId,
      title: "Healthcare Connection via QR",
      message: `${user.displayName} (${orgName}) scanned your QR code and established an authorized connection.`,
      type: "connection",
      link: "/dashboard",
      read: false,
      createdAt: new Date().toISOString(),
    };
    await store.createNotification(notification);

    // Role-specific permitted data
    const permittedData: Record<string, unknown> = {
      patient: {
        id: qrRecord.patientProfileId,
        primaryUserId: qrRecord.primaryUserId,
        name: patientName,
        ayuvSaathiId,
        relationship,
        emergencyContact,
        bloodGroup,
      },
      connection,
    };

    if (user.role === "doctor") {
      // Doctor receives medical history, reports, and medications
      const [docs, obs, meds, prescriptions] = await Promise.all([
        store.listDocuments(qrRecord.patientProfileId).catch(() => []),
        store.listObservations(qrRecord.patientProfileId).catch(() => []),
        store.listMedications(qrRecord.patientProfileId).catch(() => []),
        store.listPrescriptions(qrRecord.patientProfileId).catch(() => []),
      ]);
      permittedData.documents = docs;
      permittedData.observations = obs;
      permittedData.medications = meds;
      permittedData.prescriptions = prescriptions;
    } else if (user.role === "lab_tech") {
      // Lab Tech receives test history for context & ability to attach reports
      const docs = await store.listDocuments(qrRecord.patientProfileId).catch(() => []);
      permittedData.recentReports = docs.filter((d) => d.category === "lab_report");
    } else if (user.role === "pharmacist") {
      // Pharmacist receives ONLY active prescriptions & past bills
      const [prescriptions, meds, bills] = await Promise.all([
        store.listPrescriptions(qrRecord.patientProfileId).catch(() => []),
        store.listMedications(qrRecord.patientProfileId).catch(() => []),
        store.listPharmacyBills(qrRecord.patientProfileId).catch(() => []),
      ]);
      permittedData.prescriptions = prescriptions;
      permittedData.medications = meds.filter((m) => m.status === "active");
      permittedData.previousBills = bills;
    }

    return Response.json({
      ok: true,
      ...permittedData,
    });
  } catch (error) {
    console.error("Failed to resolve QR token:", error);
    return jsonError("Unauthorized or resolution error", 401);
  }
}
