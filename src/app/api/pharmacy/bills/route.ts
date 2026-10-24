import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";
import { canAccessPatientData } from "@/lib/auth/authorization";
import type { PharmacyBill, TimelineEvent, AppNotification, AuditLogEntry } from "@/lib/db/types";

const billSchema = z.object({
  patientProfileId: z.string().min(1),
  items: z.array(
    z.object({
      medicineName: z.string().min(1),
      quantity: z.number().min(1),
      unitPrice: z.number().min(0),
      totalPrice: z.number().min(0),
      instructions: z.string().optional(),
    })
  ).min(1),
  subtotal: z.number().min(0),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  totalAmount: z.number().min(0),
  prescriptionId: z.string().optional(),
  prescribingDoctorName: z.string().optional(),
  paymentStatus: z.enum(["paid", "pending"]).default("paid"),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const searchParams = request.nextUrl.searchParams;
    const patientProfileId = searchParams.get("patientProfileId");

    if (user.role === "pharmacist") {
      if (patientProfileId) {
        const check = await canAccessPatientData(user, patientProfileId);
        if (!check.authorized) {
          return jsonError("Unauthorized to view this patient's bills", 403);
        }
        const list = await store.listPharmacyBills(patientProfileId);
        return Response.json({ ok: true, bills: list });
      }
      const myBills = await store.listPharmacistBills(user.id);
      return Response.json({ ok: true, bills: myBills });
    }

    // Patient
    const targetId = patientProfileId || user.id;
    const check = await canAccessPatientData(user, targetId);
    if (!check.authorized) {
      return jsonError("Unauthorized to view bills", 403);
    }
    const list = await store.listPharmacyBills(targetId);
    return Response.json({ ok: true, bills: list });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);

    if (user.role !== "pharmacist") {
      return jsonError("Only authorized pharmacists can generate dispensing bills.", 403);
    }

    const body = await request.json().catch(() => null);
    const parsed = billSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid bill details. Items, subtotal, and total amount are required.", 400);
    }

    // Verify authorized collaboration to dispense medicines
    const check = await canAccessPatientData(user, parsed.data.patientProfileId, "dispenseMedicines");
    if (!check.authorized) {
      return jsonError(check.reason || "Unauthorized: No active collaboration grant to dispense for this patient", 403);
    }

    const now = new Date().toISOString();
    const billId = `PH-BILL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    let primaryUserId = parsed.data.patientProfileId;
    const fam = await store.getFamilyMember(parsed.data.patientProfileId);
    if (fam) {
      primaryUserId = fam.primaryUserId;
    }

    const pharmacyName = user.pharmacistProfile?.pharmacyName || "AyuvSaathi Partner Pharmacy";

    const bill: PharmacyBill = {
      id: billId,
      patientProfileId: parsed.data.patientProfileId,
      primaryUserId,
      pharmacistId: user.id,
      pharmacistName: user.displayName,
      pharmacyName,
      billDate: now,
      items: parsed.data.items,
      subtotal: parsed.data.subtotal,
      discount: parsed.data.discount,
      tax: parsed.data.tax,
      totalAmount: parsed.data.totalAmount,
      prescriptionId: parsed.data.prescriptionId,
      prescribingDoctorName: parsed.data.prescribingDoctorName,
      paymentStatus: parsed.data.paymentStatus,
      notes: parsed.data.notes,
      createdAt: now,
    };

    await store.savePharmacyBill(bill);

    // Update Health Timeline (explicitly categorized as medication dispensing, NOT a clinical prescription)
    const itemNames = parsed.data.items.map((i) => `${i.quantity}x ${i.medicineName}`).join(", ");
    const timelineEvent: TimelineEvent = {
      id: crypto.randomUUID(),
      ownerId: parsed.data.patientProfileId,
      type: "medication",
      relatedId: billId,
      eventDate: now,
      summary: `Medication Dispensed at ${pharmacyName} (Bill #${billId}): ${itemNames} — Total: ₹${parsed.data.totalAmount}`,
      provenance: "synthetic_demo",
      createdAt: now,
    };
    await store.addTimeline(timelineEvent);

    // Create Notification
    const notification: AppNotification = {
      id: crypto.randomUUID(),
      userId: primaryUserId,
      patientProfileId: parsed.data.patientProfileId,
      title: "Pharmacy Bill & Dispense Record",
      message: `${pharmacyName} dispensed your medicines. Bill #${billId} for ₹${parsed.data.totalAmount} has been recorded in your profile.`,
      type: "pharmacy_bill",
      link: "/dashboard",
      read: false,
      createdAt: now,
    };
    await store.createNotification(notification);

    // Audit log
    const audit: AuditLogEntry = {
      id: crypto.randomUUID(),
      actorId: user.id,
      actorRole: "pharmacist",
      actorName: user.displayName,
      patientProfileId: parsed.data.patientProfileId,
      action: "bill_generated",
      details: {
        billId,
        pharmacyName,
        totalAmount: parsed.data.totalAmount,
        itemCount: parsed.data.items.length,
        hasPrescriptionReference: Boolean(parsed.data.prescriptionId),
      },
      timestamp: now,
    };
    await store.logAudit(audit);

    return Response.json({
      ok: true,
      bill,
      message: "Pharmacy bill created and synchronized with patient timeline.",
    });
  } catch (error) {
    console.error("Pharmacy bill creation error:", error);
    return jsonError("Unauthorized or failed to create pharmacy bill", 401);
  }
}
