import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";

const updateAppointmentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  facility: z.string().max(200).optional(),
  startsAt: z.string().optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  notes: z.string().max(1000).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const existing = await store.getAppointment(id, auth.user.id);
  if (!existing) return jsonError("Appointment not found.", 404);

  const parsed = updateAppointmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid update data.", 400);

  const updated = await store.saveAppointment({
    ...existing,
    ...parsed.data,
    updatedAt: nowIso(),
  });

  return Response.json({ appointment: updated });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const ok = await store.deleteAppointment(id, auth.user.id);
  if (!ok) return jsonError("Appointment not found.", 404);

  return Response.json({ ok: true });
}
