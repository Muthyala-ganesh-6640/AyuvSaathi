import { NextRequest } from "next/server";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const event = await store.getTimelineEvent(id, auth.user.id);
  if (!event) return jsonError("Timeline event not found.", 404);

  return Response.json({ event });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const ok = await store.deleteTimelineEvent(id, auth.user.id);
  if (!ok) return jsonError("Timeline event not found.", 404);

  return Response.json({ ok: true });
}
