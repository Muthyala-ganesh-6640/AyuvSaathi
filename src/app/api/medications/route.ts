import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";

const createMedicationSchema = z.object({
  name: z.string().min(1).max(200),
  strength: z.string().min(1).max(100),
  instructions: z.string().min(1).max(500),
  route: z.string().max(100).optional().default("oral"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(["active", "paused", "completed"]).default("active"),
  times: z.array(z.string()).optional().default(["09:00"]),
  documentId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const [medications, schedules] = await Promise.all([
    store.listMedications(auth.user.id),
    store.listSchedules(auth.user.id),
  ]);

  const schedulesByMedId = new Map(schedules.map((s) => [s.medicationId, s]));

  const enriched = medications.map((med) => ({
    ...med,
    schedule: schedulesByMedId.get(med.id) || null,
  }));

  return Response.json({ medications: enriched });
}

export async function POST(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const parsed = createMedicationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Please check the medication details and instructions.", 400);
  }

  const created = nowIso();
  const medId = crypto.randomUUID();

  const medication = await store.saveMedication({
    id: medId,
    ownerId: auth.user.id,
    name: parsed.data.name,
    strength: parsed.data.strength,
    instructions: parsed.data.instructions,
    route: parsed.data.route,
    startDate: parsed.data.startDate || created.slice(0, 10),
    endDate: parsed.data.endDate,
    source: parsed.data.source,
    status: parsed.data.status,
    confirmationStatus: "confirmed",
    documentId: parsed.data.documentId,
    provenance: "user_entered",
    createdAt: created,
    updatedAt: created,
  });

  const scheduleId = crypto.randomUUID();
  const schedule = await store.saveSchedule({
    id: scheduleId,
    medicationId: medId,
    ownerId: auth.user.id,
    times: parsed.data.times.length > 0 ? parsed.data.times : ["09:00"],
    timezone: auth.user.timezone || "Asia/Kolkata",
    startDate: parsed.data.startDate || created.slice(0, 10),
    endDate: parsed.data.endDate,
    enabled: true,
    createdAt: created,
    updatedAt: created,
  });

  await store.addTimeline({
    id: crypto.randomUUID(),
    ownerId: auth.user.id,
    type: "medication",
    relatedId: medId,
    eventDate: created,
    summary: `Added medication: ${medication.name} (${medication.strength})`,
    provenance: "user_entered",
    createdAt: created,
  });

  return Response.json({ medication, schedule });
}
