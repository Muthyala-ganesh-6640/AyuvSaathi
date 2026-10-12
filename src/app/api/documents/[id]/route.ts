import { NextRequest } from "next/server";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";

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

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const ok = await store.deleteDocument(id, auth.user.id);
  if (!ok) return jsonError("Document not found.", 404);
  return Response.json({ ok: true });
}
