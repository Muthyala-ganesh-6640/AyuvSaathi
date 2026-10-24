import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";
import {
  canAccessPatientData,
  getAuthorizedPatientsForProfessional,
  type RequiredPermission,
} from "@/lib/auth/authorization";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    // Role check: Only professional roles can query this endpoint
    if (!user.role || user.role === "patient") {
      return jsonError("Access denied: Healthcare professionals only", 403);
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    // Case 1: Fetch single patient's detailed shared healthcare record
    if (patientId) {
      const requiredPermission: RequiredPermission =
        user.role === "doctor"
          ? "viewRecords"
          : user.role === "pharmacist"
          ? "viewPrescriptions"
          : "viewRecords";

      const check = await canAccessPatientData(user, patientId, requiredPermission);
      if (!check.authorized) {
        return jsonError(check.reason || "Unauthorized to access this patient's medical records", 403);
      }

      // Resolve patient identity
      let patientInfo = {
        id: patientId,
        name: "Authorized Patient",
        ayuvSaathiId: `AYUV-${patientId.slice(0, 6).toUpperCase()}`,
        relationship: "self",
        emergencyContact: undefined as string | undefined,
        bloodGroup: undefined as string | undefined,
        email: undefined as string | undefined,
      };

      const profile = await store.getProfile(patientId);
      if (profile) {
        patientInfo = {
          id: profile.id,
          name: profile.displayName || "Patient",
          email: profile.email,
          ayuvSaathiId: profile.ayuvSaathiId || `AYUV-${profile.id.slice(0, 6).toUpperCase()}`,
          relationship: "self",
          emergencyContact: undefined,
          bloodGroup: undefined,
        };
      } else {
        const fam = await store.getFamilyMember(patientId);
        if (fam) {
          patientInfo = {
            id: fam.id,
            name: fam.name,
            ayuvSaathiId: fam.ayuvSaathiId,
            relationship: fam.relationship,
            emergencyContact: fam.emergencyContact,
            bloodGroup: fam.bloodGroup,
            email: undefined,
          };
        }
      }

      // Enforce strict role-based data projection
      if (user.role === "doctor") {
        const [allDocs, obs, meds, prescriptions, timeline] = await Promise.all([
          store.listDocuments(patientId).catch(() => []),
          store.listObservations(patientId).catch(() => []),
          store.listMedications(patientId).catch(() => []),
          store.listPrescriptions(patientId).catch(() => []),
          store.listTimeline(patientId).catch(() => []),
        ]);

        const labReports = allDocs.filter(
          (d) => d.category === "lab_report" || d.category === "diagnostic_report",
        );
        const doctorSummaries = allDocs.filter(
          (d) => d.category === "doctor_visit" || d.category === "discharge_summary",
        );

        return Response.json({
          ok: true,
          patient: patientInfo,
          documents: allDocs,
          labReports,
          doctorSummaries,
          observations: obs,
          medications: meds,
          prescriptions,
          timeline,
          connection: check.connection,
        });
      }

      if (user.role === "lab_tech") {
        // Lab technicians receive diagnostic test history & biomarkers only
        const [allDocs, obs] = await Promise.all([
          store.listDocuments(patientId).catch(() => []),
          store.listObservations(patientId).catch(() => []),
        ]);
        const labReports = allDocs.filter(
          (d) => d.category === "lab_report" || d.category === "diagnostic_report",
        );

        return Response.json({
          ok: true,
          patient: patientInfo,
          labReports,
          observations: obs,
          connection: check.connection,
        });
      }

      if (user.role === "pharmacist") {
        // Pharmacists receive ONLY prescriptions, active meds, and past pharmacy bills
        const [prescriptions, meds, bills] = await Promise.all([
          store.listPrescriptions(patientId).catch(() => []),
          store.listMedications(patientId).catch(() => []),
          store.listPharmacyBills(patientId).catch(() => []),
        ]);

        return Response.json({
          ok: true,
          patient: patientInfo,
          prescriptions,
          medications: meds.filter((m) => m.status === "active"),
          bills,
          connection: check.connection,
        });
      }

      return jsonError("Unsupported professional role", 403);
    }

    // Case 2: List patients EXPLICITLY authorized for this professional
    // CRITICAL: Do NOT list all patients in the system. Only patients with active connections.
    const authorizedPatients = await getAuthorizedPatientsForProfessional(user);

    return Response.json({
      ok: true,
      patients: authorizedPatients,
    });
  } catch (error) {
    console.error("Failed to list professional patients:", error);
    return jsonError("Unauthorized or internal error", 500);
  }
}
