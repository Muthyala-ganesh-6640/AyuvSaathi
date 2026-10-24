import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  strength: z.string().min(1).max(100).optional(),
  instructions: z.string().min(1).max(500).optional(),
  route: z.string().max(100).optional(),
  status: z.enum(["active", "paused", "completed"]).optional(),
  confirmationStatus: z.enum(["unconfirmed", "confirmed", "rejected"]).optional(),
  times: z.array(z.string()).optional(),
  endDate: z.string().optional(),
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const med = await store.getMedication(id, auth.user.id);
  if (!med) return jsonError("Medication not found.", 404);

  const schedules = await store.listSchedules(auth.user.id);
  const schedule = schedules.find((s) => s.medicationId === id) || null;

  return Response.json({ medication: med, schedule });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const existing = await store.getMedication(id, auth.user.id);
  if (!existing) return jsonError("Medication not found.", 404);

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid update data.", 400);

  const now = nowIso();
  const updated = await store.saveMedication({
    ...existing,
    name: parsed.data.name ?? existing.name,
    strength: parsed.data.strength ?? existing.strength,
    instructions: parsed.data.instructions ?? existing.instructions,
    route: parsed.data.route ?? existing.route,
    status: parsed.data.status ?? existing.status,
    confirmationStatus: parsed.data.confirmationStatus ?? existing.confirmationStatus,
    endDate: parsed.data.endDate ?? existing.endDate,
    updatedAt: now,
  });

  // Synchronize associated schedule
  const schedules = await store.listSchedules(auth.user.id);
  const schedule = schedules.find((s) => s.medicationId === id);
  let updatedSchedule = schedule;

  if (schedule) {
    const isCompleted = parsed.data.status === "completed";
    const isPaused = parsed.data.status === "paused";
    const isEnabled = isCompleted || isPaused ? false : schedule.enabled;

    updatedSchedule = await store.saveSchedule({
      ...schedule,
      times: parsed.data.times && parsed.data.times.length > 0 ? parsed.data.times : schedule.times,
      endDate: parsed.data.endDate ?? schedule.endDate,
      enabled: isEnabled,
      updatedAt: now,
    });
  }

  return Response.json({
    ok: true,
    medication: updated,
    schedule: updatedSchedule,
    message: parsed.data.status === "completed"
      ? "Course concluded. Medicine reminders stopped."
      : "Medication and reminder schedule updated.",
  });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const ok = await store.deleteMedication(id, auth.user.id);
  if (!ok) return jsonError("Medication not found.", 404);

  return Response.json({ ok: true });
}
