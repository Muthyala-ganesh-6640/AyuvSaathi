import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";
import type { DoctorPrescription, Medication, TimelineEvent, AppNotification, AuditLogEntry } from "@/lib/db/types";

const prescriptionSchema = z.object({
  patientProfileId: z.string().min(1),
  diagnosis: z.string().optional(),
  items: z.array(
    z.object({
      medicineName: z.string().min(1),
      dosage: z.string().min(1),
      frequency: z.string().min(1),
      duration: z.string().min(1),
      instructions: z.string().default("Take as directed"),
    })
  ).min(1),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const searchParams = request.nextUrl.searchParams;
    const patientProfileId = searchParams.get("patientProfileId");

    if (user.role === "doctor") {
      if (patientProfileId) {
        const list = await store.listPrescriptions(patientProfileId);
        return Response.json({ ok: true, prescriptions: list });
      }
      const myDoctorPrescriptions = await store.listDoctorPrescriptions(user.id);
      return Response.json({ ok: true, prescriptions: myDoctorPrescriptions });
    }

    // Patient or Pharmacist
    const targetId = patientProfileId || user.id;
    const list = await store.listPrescriptions(targetId);
    return Response.json({ ok: true, prescriptions: list });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);

    if (user.role !== "doctor") {
      return jsonError("Only authorized medical doctors can create clinical prescriptions.", 403);
    }

    const body = await request.json().catch(() => null);
    const parsed = prescriptionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid prescription details. At least one medicine item is required.", 400);
    }

    const now = new Date().toISOString();
    const prescriptionId = crypto.randomUUID();

    // Find primary user id if patientProfileId is a family member
    let primaryUserId = parsed.data.patientProfileId;
    const fam = await store.getFamilyMember(parsed.data.patientProfileId);
    if (fam) {
      primaryUserId = fam.primaryUserId;
    }

    const prescription: DoctorPrescription = {
      id: prescriptionId,
      patientProfileId: parsed.data.patientProfileId,
      primaryUserId,
      doctorId: user.id,
      doctorName: user.displayName,
      clinicHospitalName: user.doctorProfile?.hospitalClinicName || "Authorized Clinic",
      specialization: user.doctorProfile?.specialization || "General Medicine",
      diagnosis: parsed.data.diagnosis,
      items: parsed.data.items,
      prescriptionDate: now,
      notes: parsed.data.notes,
      createdAt: now,
    };

    await store.savePrescription(prescription);

    // Synchronize items with patient's active Medication store
    for (const item of parsed.data.items) {
      const med: Medication = {
        id: crypto.randomUUID(),
        ownerId: parsed.data.patientProfileId,
        name: item.medicineName,
        strength: item.dosage,
        instructions: `${item.frequency} for ${item.duration}. ${item.instructions}`,
        status: "active",
        confirmationStatus: "confirmed",
        provenance: "synthetic_demo",
        source: `Prescribed by ${user.displayName}`,
        createdAt: now,
        updatedAt: now,
      };
      await store.saveMedication(med);
    }

    // Add Timeline Event
    const medSummary = parsed.data.items.map((i) => `${i.medicineName} (${i.dosage})`).join(", ");
    const timelineEvent: TimelineEvent = {
      id: crypto.randomUUID(),
      ownerId: parsed.data.patientProfileId,
      type: "prescription",
      relatedId: prescriptionId,
      eventDate: now,
      summary: `Clinical Prescription from ${user.displayName}: ${medSummary}`,
      provenance: "synthetic_demo",
      createdAt: now,
    };
    await store.addTimeline(timelineEvent);

    // Create Notification
    const notification: AppNotification = {
      id: crypto.randomUUID(),
      userId: primaryUserId,
      patientProfileId: parsed.data.patientProfileId,
      title: "New Clinical Prescription Received",
      message: `${user.displayName} prescribed ${parsed.data.items.length} medication(s). Automatically added to your active medications and reminders.`,
      type: "prescription",
      link: "/prescriptions",
      read: false,
      createdAt: now,
    };
    await store.createNotification(notification);

    // Log Audit
    const audit: AuditLogEntry = {
      id: crypto.randomUUID(),
      actorId: user.id,
      actorRole: "doctor",
      actorName: user.displayName,
      patientProfileId: parsed.data.patientProfileId,
      action: "prescription_created",
      details: {
        prescriptionId,
        diagnosis: parsed.data.diagnosis,
        medicineCount: parsed.data.items.length,
      },
      timestamp: now,
    };
    await store.logAudit(audit);

    return Response.json({
      ok: true,
      prescription,
      message: "Prescription created and synchronized with patient records.",
    });
  } catch (error) {
    console.error("Prescription creation error:", error);
    return jsonError("Unauthorized or failed to create prescription", 401);
  }
}
