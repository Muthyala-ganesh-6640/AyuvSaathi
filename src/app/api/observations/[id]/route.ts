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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const row = await store.getObservation(id, auth.user.id);
  if (!row) return jsonError("Observation not found.", 404);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid observation update.", 400);
  const updated = await store.saveObservation({
    ...row,
    ...parsed.data,
    provenance: parsed.data.value || parsed.data.name ? "user_entered" : row.provenance,
    uncertain: parsed.data.verificationStatus === "confirmed" ? false : row.uncertain,
    updatedAt: nowIso(),
  });
  return Response.json({ observation: updated });
}

export async function POST(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const schemaCreate = z.object({
    documentId: z.string().uuid(),
    name: z.string().min(1).max(200),
    value: z.string().min(1).max(80),
    unit: z.string().max(40).optional().default(""),
    referenceRange: z.string().max(80).optional(),
  });
  const parsed = schemaCreate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter a test name and the value shown on the document.", 400);
  const document = await store.getDocument(parsed.data.documentId, auth.user.id);
  if (!document) return jsonError("Document not found.", 404);
  const created = nowIso();
  const observation = await store.saveObservation({
    id: crypto.randomUUID(),
    ownerId: auth.user.id,
    documentId: document.id,
    name: parsed.data.name,
    value: parsed.data.value,
    unit: parsed.data.unit ?? "",
    referenceRange: parsed.data.referenceRange,
    uncertain: false,
    verificationStatus: "confirmed",
    provenance: "user_entered",
    createdAt: created,
    updatedAt: created,
  });
  return Response.json({ observation });
}
