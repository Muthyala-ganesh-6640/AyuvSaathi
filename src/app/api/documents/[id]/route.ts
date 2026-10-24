import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";
import type { DocumentCategory } from "@/lib/db/types";

const patchDocSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  category: z
    .enum([
      "lab_report",
      "prescription",
      "imaging",
      "discharge_summary",
      "doctor_visit",
      "diagnostic_report",
      "other",
    ])
    .optional(),
  sourceDate: z.string().optional(),
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const document = await store.getDocument(id, auth.user.id);
  if (!document) return jsonError("Document not found.", 404);
  const [observations, extractions] = await Promise.all([
    store.listObservations(auth.user.id, id),
    store.listExtractions(id, auth.user.id),
  ]);
  return Response.json({ document, observations, extractions });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const existing = await store.getDocument(id, auth.user.id);
  if (!existing) return jsonError("Document not found.", 404);

  const parsed = patchDocSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid update data.", 400);

  const updated = await store.saveDocument({
    ...existing,
    ...parsed.data,
    category: (parsed.data.category as DocumentCategory) || existing.category,
    updatedAt: nowIso(),
  });

  return Response.json({ document: updated });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const ok = await store.deleteDocument(id, auth.user.id);
  if (!ok) return jsonError("Document not found.", 404);
  return Response.json({ ok: true });
}
