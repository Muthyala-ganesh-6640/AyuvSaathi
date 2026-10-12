import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";

const updateVisitSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  sourceIds: z.array(z.string()).optional(),
  content: z.string().min(1).max(5000).optional(),
  questions: z.array(z.string()).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const visit = await store.getVisit(id, auth.user.id);
  if (!visit) return jsonError("Visit summary not found.", 404);

  return Response.json({ visit });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const existing = await store.getVisit(id, auth.user.id);
  if (!existing) return jsonError("Visit summary not found.", 404);

  const parsed = updateVisitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid update data.", 400);

  const updated = await store.saveVisit({
    ...existing,
    ...parsed.data,
    updatedAt: nowIso(),
  });

  return Response.json({ visit: updated });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const ok = await store.deleteVisit(id, auth.user.id);
  if (!ok) return jsonError("Visit summary not found.", 404);

  return Response.json({ ok: true });
}
