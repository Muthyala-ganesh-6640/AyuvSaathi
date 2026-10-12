import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";

const doseUpdateSchema = z.object({
  status: z.enum(["pending", "taken", "skipped", "missed"]),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const dose = await store.getDose(id, auth.user.id);
  if (!dose) return jsonError("Dose event not found.", 404);

  const parsed = doseUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid dose status.", 400);

  const now = nowIso();
  const updated = await store.saveDose({
    ...dose,
    status: parsed.data.status,
    eventTime: parsed.data.status === "taken" ? now : dose.eventTime,
    source: "user",
    updatedAt: now,
  });

  if (parsed.data.status === "taken") {
    const med = await store.getMedication(dose.medicationId, auth.user.id);
    await store.addTimeline({
      id: crypto.randomUUID(),
      ownerId: auth.user.id,
      type: "dose",
      relatedId: dose.id,
      eventDate: now,
      summary: `Logged medication taken: ${med?.name ?? "Medicine"} at ${dose.scheduledTime}`,
      provenance: "user_entered",
      createdAt: now,
    });
  }

  return Response.json({ dose: updated });
}
