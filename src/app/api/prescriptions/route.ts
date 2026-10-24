import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";
import { canAccessPatientData } from "@/lib/auth/authorization";
import {
  frequencyToTimes,
  parseCourseDates,
  durationToDays,
  addDays,
  localDateKey,
} from "@/lib/medical/schedules";
import { ensureUpcomingDoses } from "@/lib/medical/ensure-doses";
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
        const check = await canAccessPatientData(user, patientProfileId, "viewPrescriptions");
        if (!check.authorized) {
          return jsonError("Unauthorized to view this patient's prescriptions", 403);
        }
        const list = await store.listPrescriptions(patientProfileId);
        return Response.json({ ok: true, prescriptions: list });
      }
      const myDoctorPrescriptions = await store.listDoctorPrescriptions(user.id);
      return Response.json({ ok: true, prescriptions: myDoctorPrescriptions });
    }

    // Patient or Pharmacist
    const targetId = patientProfileId || user.id;
    const check = await canAccessPatientData(user, targetId, "viewPrescriptions");
    if (!check.authorized) {
      return jsonError("Unauthorized to view prescriptions", 403);
    }
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

    // Enforce explicit collaboration check
    const check = await canAccessPatientData(user, parsed.data.patientProfileId, "createPrescription");
    if (!check.authorized) {
      return jsonError(check.reason || "Unauthorized: No active collaboration grant to prescribe for this patient", 403);
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

    // Synchronize items with patient's active Medication store & Schedules
    const patientProfile = (await store.getProfile(parsed.data.patientProfileId)) || user;
    const tz = patientProfile.timezone || "Asia/Kolkata";
    const today = localDateKey(new Date(), tz);

    for (const item of parsed.data.items) {
      const { startDate, endDate } = parseCourseDates(item.duration, today, tz);
      const times = frequencyToTimes(item.frequency);
      const medId = crypto.randomUUID();

      const med: Medication = {
        id: medId,
        ownerId: parsed.data.patientProfileId,
        name: item.medicineName,
        strength: item.dosage,
        instructions: `${item.frequency} for ${item.duration}. ${item.instructions}`,
        startDate,
        endDate,
        status: "active",
        confirmationStatus: "confirmed",
        provenance: "synthetic_demo",
        source: `Prescribed by ${user.displayName}`,
        createdAt: now,
        updatedAt: now,
      };
      await store.saveMedication(med);

      // Save Medication Schedule so dose events are automatically generated
      await store.saveSchedule({
        id: crypto.randomUUID(),
        medicationId: medId,
        ownerId: parsed.data.patientProfileId,
        times,
        timezone: tz,
        startDate,
        endDate,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Generate upcoming doses for patient
    await ensureUpcomingDoses(patientProfile, 7);

    // Check for follow-up advice in prescription notes
    if (parsed.data.notes && /follow[\s-]?up|review|visit|after\s+\d+\s+(day|week|month)/i.test(parsed.data.notes)) {
      const followUpDays = durationToDays(parsed.data.notes) || 14;
      const followUpDate = addDays(today, followUpDays);
      const appointmentId = crypto.randomUUID();
      await store.saveAppointment({
        id: appointmentId,
        ownerId: parsed.data.patientProfileId,
        title: `Clinical Follow-up with ${user.displayName}`,
        facility: user.doctorProfile?.hospitalClinicName || "Clinic Consultation",
        startsAt: `${followUpDate}T10:00:00.000Z`,
        timezone: tz,
        status: "scheduled",
        notes: `Prescription follow-up: ${parsed.data.notes}`,
        createdAt: now,
        updatedAt: now,
      });

      await store.createNotification({
        id: crypto.randomUUID(),
        userId: primaryUserId,
        patientProfileId: parsed.data.patientProfileId,
        title: "Follow-up Consultation Scheduled",
        message: `Dr. ${user.displayName} advised a follow-up consultation on ${followUpDate}. Automatically added to your appointments.`,
        type: "appointment",
        link: "/appointments",
        read: false,
        createdAt: now,
      });
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
      message: `${user.displayName} prescribed ${parsed.data.items.length} medication(s). Medicine reminders have been set for your prescribed schedule.`,
      type: "prescription",
      link: "/reminders",
      read: false,
      createdAt: now,
    };
    await store.createNotification(notification);

    // Log Audit
    const audit: AuditLogEntry = {
      id: crypto.randomUUID(),
      actorId: user.id,
      actorRole: user.role || "doctor",
      actorName: user.displayName,
      patientProfileId: parsed.data.patientProfileId,
      action: "prescription_created",
      details: {
        resource: "prescriptions",
        resourceId: prescriptionId,
        diagnosis: parsed.data.diagnosis,
        itemsCount: parsed.data.items.length,
        prescribedBy: user.displayName,
      },
      timestamp: now,
    };
    await store.logAudit(audit);

    return Response.json({
      ok: true,
      prescription,
      message: "Prescription successfully recorded, synchronized to medications and active reminders.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error creating prescription";
    return jsonError(message, 500);
  }
}
