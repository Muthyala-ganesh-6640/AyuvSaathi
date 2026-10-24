import { NextRequest } from "next/server";
import { z } from "zod";
import { SignJWT, jwtVerify } from "jose";
import { store, hashToken, mutate } from "@/lib/db/file-store";
import { hashPassword, passwordIssues } from "@/lib/auth/password";
import { secretKey } from "@/lib/auth/session";
import { jsonError, limitOrThrow } from "@/lib/api";
import { clientIp, nowIso } from "@/lib/utils";
import { isSmtpConfigured } from "@/lib/env";
import { sendPasswordResetEmail } from "@/lib/email/mailer";

const requestSchema = z.object({
  email: z.string().email(),
});

const confirmSchema = z.object({
  token: z.string().min(10),
  password: z.string(),
});

export async function POST(request: NextRequest) {
  const limited = limitOrThrow(`reset:${clientIp(request.headers)}`, 12, 15 * 60_000);
  if (limited) return limited;
  const body = await request.json().catch(() => null);

  // 1. Password Confirmation Step
  const confirm = confirmSchema.safeParse(body);
  if (confirm.success) {
    const issues = passwordIssues(confirm.data.password);
    if (issues.length) return jsonError(issues.join(" "), 400);

    let userId: string | null = null;
    const rawToken = confirm.data.token.trim();

    // Check signed JWT token first (stateless, works across serverless and local restarts)
    try {
      const key = await secretKey();
      const { payload } = await jwtVerify(rawToken, key);
      if (payload.purpose === "password_reset" && typeof payload.sub === "string") {
        userId = payload.sub;
      }
    } catch {
      // Not a valid JWT or expired, check legacy database token
    }

    // Check database token if JWT verification was not applicable
    if (!userId) {
      const tokenHash = hashToken(rawToken);
      const row = await store.consumeResetToken(tokenHash);
      if (row && !row.usedAt && row.expiresAt >= nowIso()) {
        userId = row.userId;
      }
    }

    if (!userId) {
      return jsonError("This reset token is invalid or has expired. Please request a new link.", 400);
    }

    const profile = await store.getProfile(userId);
    if (!profile) {
      return jsonError("No user account matching this reset request was found.", 400);
    }

    const newHash = await hashPassword(confirm.data.password);
    await store.upsertProfile({
      ...profile,
      passwordHash: newHash,
      updatedAt: nowIso(),
    });

    // Mark any matching tokens as used in store
    await mutate((db) => {
      const tHash = hashToken(rawToken);
      for (const t of db.resetTokens) {
        if (t.tokenHash === tHash || t.userId === userId) {
          t.usedAt = nowIso();
        }
      }
    });

    return Response.json({
      ok: true,
      message: "Your password has been changed successfully. You can now sign in.",
    });
  }

  // 2. Token Request Step
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return jsonError("Please enter a valid email address.", 400);

  const cleanEmail = parsed.data.email.toLowerCase().trim();
  const profile = await store.getProfileByEmail(cleanEmail);

  const smtpReady = isSmtpConfigured();

  if (!profile) {
    return Response.json({
      ok: true,
      accountExists: false,
      message: "If an account with this email exists, recovery instructions have been prepared.",
      emailConfigured: smtpReady,
    });
  }

  // Generate self-contained signed JWT recovery token (1-hour validity)
  const token = await new SignJWT({
    sub: profile.id,
    email: profile.email,
    purpose: "password_reset",
    v: profile.updatedAt,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(await secretKey());

  // Store in file-store as well for tracking
  await store.addResetToken({
    id: crypto.randomUUID(),
    userId: profile.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  // Build reset link
  const origin = request.headers.get("origin") || request.nextUrl.origin || process.env.APP_URL || "http://localhost:3000";
  const locale = profile.interfaceLanguage || "en";
  const resetUrl = `${origin}/${locale}/auth/reset?token=${encodeURIComponent(token)}&email=${encodeURIComponent(profile.email)}`;

  let emailSent = false;
  let emailError: string | undefined;

  if (smtpReady) {
    const sendResult = await sendPasswordResetEmail({
      to: profile.email,
      recipientName: profile.displayName || profile.email.split("@")[0],
      resetUrl,
      resetToken: token,
    });
    emailSent = sendResult.sent;
    emailError = sendResult.error;
  }

  return Response.json({
    ok: true,
    accountExists: true,
    emailSent,
    emailConfigured: smtpReady,
    emailError: emailSent ? undefined : emailError,
    message: emailSent
      ? `A password reset link has been sent to ${profile.email}.`
      : smtpReady
        ? `Failed to send email (${emailError || "SMTP error"}). Use the recovery token below.`
        : "SMTP email is not configured. A recovery token has been generated below for testing.",
    developmentToken: token,
    resetUrl,
  });
}
