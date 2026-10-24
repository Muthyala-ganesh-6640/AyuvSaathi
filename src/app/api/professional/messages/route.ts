import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";
import type { ProfessionalMessage, AppNotification, AuditLogEntry } from "@/lib/db/types";

const messageSchema = z.object({
  patientProfileId: z.string().min(1),
  professionalId: z.string().min(1),
  message: z.string().min(1).max(2000),
  isEmergency: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const searchParams = request.nextUrl.searchParams;
    const patientProfileId = searchParams.get("patientProfileId");
    const professionalId = searchParams.get("professionalId") || (user.role !== "patient" ? user.id : undefined);

    if (!patientProfileId) {
      return jsonError("patientProfileId is required", 400);
    }

    const messages = await store.listProfessionalMessages(patientProfileId, professionalId);
    return Response.json({ ok: true, messages });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => null);
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid message parameters", 400);
    }

    let primaryUserId = parsed.data.patientProfileId;
    const fam = await store.getFamilyMember(parsed.data.patientProfileId);
    if (fam) {
      primaryUserId = fam.primaryUserId;
    }

    const now = new Date().toISOString();
    const msgId = crypto.randomUUID();

    const professionalMessage: ProfessionalMessage = {
      id: msgId,
      patientProfileId: parsed.data.patientProfileId,
      primaryUserId,
      professionalId: parsed.data.professionalId,
      senderId: user.id,
      senderRole: user.role || "patient",
      senderName: user.displayName,
      message: parsed.data.message.trim(),
      isEmergency: parsed.data.isEmergency,
      createdAt: now,
    };

    await store.saveProfessionalMessage(professionalMessage);

    // Send notification to recipient
    const recipientUserId = user.id === parsed.data.professionalId ? primaryUserId : parsed.data.professionalId;
    const notification: AppNotification = {
      id: crypto.randomUUID(),
      userId: recipientUserId,
      patientProfileId: parsed.data.patientProfileId,
      title: parsed.data.isEmergency ? "URGENT: Doctor Emergency Ping" : `Message from ${user.displayName}`,
      message: parsed.data.isEmergency
        ? `[EMERGENCY CHANNEL] ${user.displayName}: ${parsed.data.message.slice(0, 120)}`
        : `${user.displayName}: ${parsed.data.message.slice(0, 120)}`,
      type: parsed.data.isEmergency ? "emergency" : "general",
      link: user.role === "doctor" ? "/doctor" : "/dashboard",
      read: false,
      createdAt: now,
    };
    await store.createNotification(notification);

    if (parsed.data.isEmergency) {
      // Audit log for emergency ping
      const audit: AuditLogEntry = {
        id: crypto.randomUUID(),
        actorId: user.id,
        actorRole: user.role || "patient",
        actorName: user.displayName,
        patientProfileId: parsed.data.patientProfileId,
        action: "emergency_ping",
        details: {
          recipientId: recipientUserId,
          messageSnippet: parsed.data.message.slice(0, 80),
        },
        timestamp: now,
      };
      await store.logAudit(audit);
    }

    return Response.json({
      ok: true,
      message: professionalMessage,
      disclaimer: parsed.data.isEmergency
        ? "Doctor Emergency Communication alerts your connected physician. For immediate life-threatening medical emergencies, please call official emergency services: 108 (Ambulance) or 112 (National Emergency)."
        : undefined,
    });
  } catch (error) {
    console.error("Failed to send professional message:", error);
    return jsonError("Unauthorized or failed to send message", 401);
  }
}
