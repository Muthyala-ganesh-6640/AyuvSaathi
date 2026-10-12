import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { publicProfile } from "@/lib/auth/session";
import { nowIso } from "@/lib/utils";
import { serviceStatus } from "@/lib/env";

const patchSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  interfaceLanguage: z.enum(["en", "te", "hi"]).optional(),
  aiLanguage: z.enum(["en", "te", "hi"]).optional(),
  timezone: z.string().max(80).optional(),
  notifyReminders: z.boolean().optional(),
  onboardingComplete: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  return Response.json({ user: publicProfile(auth.user), services: serviceStatus() });
}

export async function PATCH(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid settings.", 400);
  const updated = await store.upsertProfile({
    ...auth.user,
    ...parsed.data,
    updatedAt: nowIso(),
  });
  return Response.json({ user: publicProfile(updated) });
}
