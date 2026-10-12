import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";

const createVisitSchema = z.object({
  title: z.string().min(1).max(200),
  sourceIds: z.array(z.string()).default([]),
  content: z.string().min(1).max(5000),
  questions: z.array(z.string()).default([]),
});

export async function GET(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const visits = await store.listVisits(auth.user.id);
  return Response.json({ visits });
}

export async function POST(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const parsed = createVisitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Please fill out the visit summary title and content.", 400);

  const now = nowIso();
  const visit = await store.saveVisit({
    id: crypto.randomUUID(),
    ownerId: auth.user.id,
    title: parsed.data.title,
    sourceIds: parsed.data.sourceIds,
    content: parsed.data.content,
    questions: parsed.data.questions,
    createdAt: now,
    updatedAt: now,
  });

  await store.addTimeline({
    id: crypto.randomUUID(),
    ownerId: auth.user.id,
    type: "visit",
    relatedId: visit.id,
    eventDate: now,
    summary: `Created doctor visit summary: ${visit.title}`,
    provenance: "user_entered",
    createdAt: now,
  });

  return Response.json({ visit });
}
