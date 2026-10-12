import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";

const createConvSchema = z.object({
  title: z.string().min(1).max(200).optional().default("New Health Consultation"),
});

export async function GET(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const conversations = await store.listConversations(auth.user.id);
  return Response.json({ conversations });
}

export async function POST(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const parsed = createConvSchema.safeParse(await request.json().catch(() => ({})));
  const title = parsed.success ? parsed.data.title : "New Health Consultation";

  const now = nowIso();
  const conv = await store.saveConversation({
    id: crypto.randomUUID(),
    ownerId: auth.user.id,
    language: auth.user.aiLanguage,
    title,
    createdAt: now,
    updatedAt: now,
  });

  return Response.json({ conversation: conv });
}
