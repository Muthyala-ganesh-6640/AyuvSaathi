import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";

const createAppointmentSchema = z.object({
  title: z.string().min(1).max(200),
  facility: z.string().max(200).optional(),
  startsAt: z.string(),
  notes: z.string().max(1000).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const appointments = await store.listAppointments(auth.user.id);
  return Response.json({ appointments });
}

export async function POST(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const parsed = createAppointmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter an appointment title and valid date/time.", 400);

  const now = nowIso();
  const appointment = await store.saveAppointment({
    id: crypto.randomUUID(),
    ownerId: auth.user.id,
    title: parsed.data.title,
    facility: parsed.data.facility,
    startsAt: parsed.data.startsAt,
    timezone: auth.user.timezone || "Asia/Kolkata",
    status: "scheduled",
    notes: parsed.data.notes,
    createdAt: now,
    updatedAt: now,
  });

  await store.addTimeline({
    id: crypto.randomUUID(),
    ownerId: auth.user.id,
    type: "appointment",
    relatedId: appointment.id,
    eventDate: parsed.data.startsAt,
    summary: `Scheduled appointment: ${appointment.title} at ${appointment.facility ?? "Clinic"}`,
    provenance: "user_entered",
    createdAt: now,
  });

  return Response.json({ appointment });
}
