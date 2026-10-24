import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1).max(200).optional(),
  value: z.string().min(1).max(80).optional(),
  unit: z.string().max(40).optional(),
  referenceRange: z.string().max(80).optional(),
  verificationStatus: z.enum(["unconfirmed", "confirmed", "rejected"]).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const observation = await store.getObservation(id, auth.user.id);
  if (!observation) return jsonError("Observation not found.", 404);

  return Response.json({ observation });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const row = await store.getObservation(id, auth.user.id);
  if (!row) return jsonError("Observation not found.", 404);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid observation update data.", 400);

  const updated = await store.saveObservation({
    ...row,
    ...parsed.data,
    provenance: parsed.data.value || parsed.data.name ? "user_entered" : row.provenance,
    uncertain: parsed.data.verificationStatus === "confirmed" ? false : row.uncertain,
    updatedAt: nowIso(),
  });

  return Response.json({ observation: updated });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const ok = await store.deleteObservation(id, auth.user.id);
  if (!ok) return jsonError("Observation not found.", 404);

  return Response.json({ ok: true });
}
