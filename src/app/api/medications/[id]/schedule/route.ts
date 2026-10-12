import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";

const scheduleSchema = z.object({
  times: z.array(z.string()).min(1),
  enabled: z.boolean().optional().default(true),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const med = await store.getMedication(id, auth.user.id);
  if (!med) return jsonError("Medication not found.", 404);

  const parsed = scheduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Please specify at least one valid time.", 400);

  const schedules = await store.listSchedules(auth.user.id);
  const existing = schedules.find((s) => s.medicationId === id);

  const created = nowIso();
  const schedule = await store.saveSchedule({
    id: existing ? existing.id : crypto.randomUUID(),
    medicationId: id,
    ownerId: auth.user.id,
    times: parsed.data.times,
    timezone: auth.user.timezone || "Asia/Kolkata",
    startDate: parsed.data.startDate || (existing ? existing.startDate : created.slice(0, 10)),
    endDate: parsed.data.endDate,
    enabled: parsed.data.enabled,
    createdAt: existing ? existing.createdAt : created,
    updatedAt: created,
  });

  return Response.json({ schedule });
}
