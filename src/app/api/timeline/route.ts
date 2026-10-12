import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";

const timelineCreateSchema = z.object({
  type: z.enum([
    "document",
    "prescription",
    "medication",
    "dose",
    "appointment",
    "visit",
    "observation",
    "discharge",
    "consultation",
  ]),
  summary: z.string().min(1).max(300),
  relatedId: z.string().optional(),
  eventDate: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const timeline = await store.listTimeline(auth.user.id);
  return Response.json({ timeline });
}

export async function POST(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const parsed = timelineCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid timeline entry.", 400);

  const created = nowIso();
  const event = await store.addTimeline({
    id: crypto.randomUUID(),
    ownerId: auth.user.id,
    type: parsed.data.type,
    relatedId: parsed.data.relatedId,
    eventDate: parsed.data.eventDate || created,
    summary: parsed.data.summary,
    provenance: "user_entered",
    createdAt: created,
  });

  return Response.json({ event });
}