import { NextRequest } from "next/server";
import { z } from "zod";
import { store, hashToken } from "@/lib/db/file-store";
import { hashPassword, passwordIssues } from "@/lib/auth/password";
import { jsonError, limitOrThrow } from "@/lib/api";
import { clientIp, nowIso } from "@/lib/utils";
import { isSmtpConfigured } from "@/lib/env";
import { mutate } from "@/lib/db/file-store";

const requestSchema = z.object({
  email: z.string().email(),
});

const confirmSchema = z.object({
  token: z.string().min(20),
  password: z.string(),
});

export async function POST(request: NextRequest) {
  const limited = limitOrThrow(`reset:${clientIp(request.headers)}`, 6, 15 * 60_000);
  if (limited) return limited;
  const body = await request.json().catch(() => null);
  const confirm = confirmSchema.safeParse(body);
  if (confirm.success) {
    const issues = passwordIssues(confirm.data.password);
    if (issues.length) return jsonError(issues.join(" "), 400);
    const tokenHash = hashToken(confirm.data.token);
    const row = await store.consumeResetToken(tokenHash);
    if (!row || row.usedAt || row.expiresAt < nowIso()) {
      return jsonError("This reset link is invalid or has expired.", 400);
    }
    const profile = await store.getProfile(row.userId);
    if (!profile) return jsonError("This reset link is invalid or has expired.", 400);
    await store.upsertProfile({
      ...profile,
      passwordHash: await hashPassword(confirm.data.password),
      updatedAt: nowIso(),
    });
    await mutate((db) => {
      const t = db.resetTokens.find((x) => x.id === row.id);
      if (t) t.usedAt = nowIso();
    });
    return Response.json({ ok: true });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return jsonError("Enter a valid email address.", 400);
  const profile = await store.getProfileByEmail(parsed.data.email);
  const generic = {
    ok: true,
    message:
      "If an account exists, a reset option was created. Email delivery requires SMTP configuration.",
    emailConfigured: isSmtpConfigured(),
  };
  if (!profile) return Response.json(generic);
  const token = crypto.randomUUID() + crypto.randomUUID();
  await store.addResetToken({
    id: crypto.randomUUID(),
    userId: profile.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (!isSmtpConfigured()) {
    console.info("Password reset token created for a local account. SMTP is not configured, so no email was sent.");
    return Response.json({
      ...generic,
      developmentToken: process.env.NODE_ENV === "production" ? undefined : token,
    });
  }
  return Response.json(generic);
}
