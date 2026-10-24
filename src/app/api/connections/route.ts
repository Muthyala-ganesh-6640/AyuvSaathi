import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";
import { canAccessPatientData } from "@/lib/auth/authorization";
import type { AuditLogEntry, AppNotification } from "@/lib/db/types";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const searchParams = request.nextUrl.searchParams;
    const patientProfileId = searchParams.get("patientProfileId") || user.id;

    if (user.role && user.role !== "patient") {
      const connections = await store.listProfessionalConnections(user.id);
      return Response.json({ ok: true, connections });
    }

    // Patient access
    const check = await canAccessPatientData(user, patientProfileId);
    if (!check.authorized) {
      return jsonError("Unauthorized to view connections for this profile", 403);
    }

    const connections = await store.listConnections(patientProfileId);
    return Response.json({ ok: true, connections });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}

/**
 * Revoke or update a healthcare connection
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const { id, status } = body;

    if (!id || typeof id !== "string") {
      return jsonError("Connection ID is required", 400);
    }

    if (status !== "revoked" && status !== "active") {
      return jsonError("Invalid status. Supported: active, revoked", 400);
    }

    const connection = await store.getConnection(id);
    if (!connection) {
      return jsonError("Connection not found", 404);
    }

    // Only the patient (or primary user) who granted access can revoke it
    const isOwner = connection.primaryUserId === user.id || connection.patientProfileId === user.id;
    const isAssignedProfessional = connection.professionalId === user.id;

    if (!isOwner && !isAssignedProfessional) {
      return jsonError("Unauthorized: Only the patient or assigned professional can modify this collaboration", 403);
    }

    const updated = await store.updateConnectionStatus(id, status);

    // Audit log entry
    const auditEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      actorId: user.id,
      actorRole: user.role || "patient",
      actorName: user.displayName,
      patientProfileId: connection.patientProfileId,
      action: status === "revoked" ? "connection_revoked" : "connection_updated",
      details: {
        connectionId: id,
        professionalId: connection.professionalId,
        professionalRole: connection.professionalRole,
        newStatus: status,
      },
      timestamp: new Date().toISOString(),
    };
    await store.logAudit(auditEntry);

    // Notify affected professional
    const notification: AppNotification = {
      id: crypto.randomUUID(),
      userId: connection.professionalId,
      patientProfileId: connection.patientProfileId,
      title: status === "revoked" ? "Collaboration Access Revoked" : "Collaboration Status Updated",
      message: `Patient ${user.displayName} updated the collaboration status to: ${status}.`,
      type: "connection",
      read: false,
      createdAt: new Date().toISOString(),
    };
    await store.createNotification(notification);

    return Response.json({ ok: true, connection: updated });
  } catch {
    return jsonError("Internal error updating connection", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return jsonError("Connection ID is required", 400);
    }

    const connection = await store.getConnection(id);
    if (!connection) {
      return jsonError("Connection not found", 404);
    }

    const isOwner = connection.primaryUserId === user.id || connection.patientProfileId === user.id;
    if (!isOwner) {
      return jsonError("Unauthorized: Only the patient can revoke access", 403);
    }

    const updated = await store.updateConnectionStatus(id, "revoked");
    return Response.json({ ok: true, connection: updated });
  } catch {
    return jsonError("Internal error revoking connection", 500);
  }
}
