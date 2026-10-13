import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { hashPassword, passwordIssues } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { jsonError, limitOrThrow } from "@/lib/api";
import { clientIp, nowIso } from "@/lib/utils";
import type { Locale } from "@/lib/db/types";

const schema = z.object({
  email: z.string().email(),
  password: z.string(),
  displayName: z.string().min(1).max(80),
  interfaceLanguage: z.enum(["en", "te", "hi"]).default("en"),
  timezone: z.string().max(80).optional(),
});

export async function POST(request: NextRequest) {
  const limited = limitOrThrow(`signup:${clientIp(request.headers)}`, 8, 15 * 60_000);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Please check the form and try again.", 400);
  const issues = passwordIssues(parsed.data.password);
  if (issues.length) return jsonError(issues.join(" "), 400);
  const existing = await store.getProfileByEmail(parsed.data.email);
  if (existing) return jsonError("An account with this email already exists.", 409);
  const created = nowIso();
  const profile = await store.upsertProfile({
    id: crypto.randomUUID(),
    email: parsed.data.email.toLowerCase(),
    passwordHash: await hashPassword(parsed.data.password),
    displayName: parsed.data.displayName.trim(),
    interfaceLanguage: parsed.data.interfaceLanguage as Locale,
    aiLanguage: parsed.data.interfaceLanguage as Locale,
    timezone: parsed.data.timezone || "Asia/Kolkata",
    notifyReminders: true,
    onboardingComplete: false,
    emailVerified: false,
    createdAt: created,
    updatedAt: created,
  });
  const { cookieHeader } = await createSession(profile.id);
  const response = Response.json({ ok: true, language: profile.interfaceLanguage });
  if (cookieHeader) {
    response.headers.set("set-cookie", cookieHeader);
  }
  return response;
}
