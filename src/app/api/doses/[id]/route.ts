import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";
import { snoozeTime } from "@/lib/medical/schedules";

const doseUpdateSchema = z.object({
  status: z.enum(["pending", "taken", "skipped", "missed"]).optional(),
  snoozeMinutes: z.number().min(1).max(180).optional(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const dose = await store.getDose(id, auth.user.id);
  if (!dose) return jsonError("Dose event not found.", 404);

  const parsed = doseUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid dose update data.", 400);

  const now = nowIso();
  let updatedScheduledTime = dose.scheduledTime;
  let updatedStatus = parsed.data.status || dose.status;

  // Handle snooze
  if (parsed.data.snoozeMinutes) {
    updatedScheduledTime = snoozeTime(dose.scheduledTime, parsed.data.snoozeMinutes);
    updatedStatus = "pending"; // Keeps active for the newly snoozed time
  } else if (parsed.data.scheduledTime) {
    updatedScheduledTime = parsed.data.scheduledTime;
  }

  const updated = await store.saveDose({
    ...dose,
    scheduledTime: updatedScheduledTime,
    status: updatedStatus,
    eventTime: updatedStatus === "taken" ? now : dose.eventTime,
    source: "user",
    updatedAt: now,
  });

  const med = await store.getMedication(dose.medicationId, auth.user.id);

  if (updatedStatus === "taken") {
    await store.addTimeline({
      id: crypto.randomUUID(),
      ownerId: auth.user.id,
      type: "dose",
      relatedId: dose.id,
      eventDate: now,
      summary: `Confirmed medication taken: ${med?.name ?? "Medicine"} (${dose.scheduledDate} at ${updatedScheduledTime})`,
      provenance: "user_entered",
      createdAt: now,
    });
  } else if (parsed.data.snoozeMinutes) {
    await store.addTimeline({
      id: crypto.randomUUID(),
      ownerId: auth.user.id,
      type: "dose",
      relatedId: dose.id,
      eventDate: now,
      summary: `Snoozed medication reminder: ${med?.name ?? "Medicine"} by ${parsed.data.snoozeMinutes} mins (new time: ${updatedScheduledTime})`,
      provenance: "user_entered",
      createdAt: now,
    });
  }

  return Response.json({
    ok: true,
    dose: updated,
    message: parsed.data.snoozeMinutes
      ? `Dose snoozed to ${updatedScheduledTime}`
      : `Dose updated to ${updatedStatus}`,
  });
}
