import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { getEnv } from "@/lib/env";
import { getDataDir, store } from "@/lib/db/file-store";
import type { Profile, Locale } from "@/lib/db/types";

export const SESSION_COOKIE = "arogya_session";

let fallbackInMemorySecret: string | null = null;

export async function secretKey() {
  const env = getEnv();
  const secret = env.AUTH_SECRET || process.env.AUTH_SECRET || "ayuvsaathi-super-secret-auth-key-2026-production-ready-companion";
  if (secret && secret.length >= 16) {
    return new TextEncoder().encode(secret);
  }
  const dir = getDataDir();
  const file = path.join(dir, "auth-secret");
  try {
    await fs.mkdir(dir, { recursive: true });
    const existing = await fs.readFile(file, "utf8");
    return new TextEncoder().encode(existing.trim());
  } catch {
    if (!fallbackInMemorySecret) {
      fallbackInMemorySecret = randomBytes(32).toString("hex");
      await fs.writeFile(file, fallbackInMemorySecret, "utf8").catch(() => undefined);
    }
    return new TextEncoder().encode(fallbackInMemorySecret);
  }
}

export function isSecureContext(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  return (
    process.env.COOKIE_SECURE === "true" ||
    (process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https://") ||
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.VERCEL)
  );
}

/**
 * Create a self-contained JWT session that embeds essential profile data.
 * This ensures the session survives Vercel serverless cold starts where
 * the ephemeral /tmp file store is lost between invocations.
 */
export async function createSession(userOrId: Profile | string): Promise<{ token: string; cookieHeader: string }> {
  let profile: Profile | null = null;
  if (typeof userOrId === "string") {
    try {
      profile = await store.getProfile(userOrId);
    } catch {
      profile = null;
    }
  } else {
    profile = userOrId;
  }

  const sub = typeof userOrId === "string" ? userOrId : userOrId.id;
  const claims: Record<string, unknown> = { sub };
  if (profile) {
    claims.email = profile.email;
    claims.displayName = profile.displayName;
    claims.interfaceLanguage = profile.interfaceLanguage || "en";
    claims.aiLanguage = profile.aiLanguage || "en";
    claims.timezone = profile.timezone || "Asia/Kolkata";
    claims.notifyReminders = profile.notifyReminders ?? true;
    claims.onboardingComplete = profile.onboardingComplete ?? false;
    claims.emailVerified = profile.emailVerified ?? false;
    claims.createdAt = profile.createdAt;
  }

  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(await secretKey());
  const secure = isSecureContext();
  const maxAge = 60 * 60 * 24 * 7;
  const cookieHeader = `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}; Max-Age=${maxAge}`;

  try {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge,
    });
  } catch {
    // cookies() may throw outside Next.js request store context (e.g. tests)
  }

  return { token, cookieHeader };
}

export async function clearSession(): Promise<string> {
  const secure = isSecureContext();
  const cookieHeader = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}; Max-Age=0`;

  try {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 0,
    });
  } catch {
    // cookies() may throw outside Next.js request store context
  }

  return cookieHeader;
}

/** Decoded JWT payload with embedded profile data */
interface SessionPayload {
  sub: string;
  email?: string;
  displayName?: string;
  interfaceLanguage?: string;
  aiLanguage?: string;
  timezone?: string;
  notifyReminders?: boolean;
  onboardingComplete?: boolean;
  emailVerified?: boolean;
  createdAt?: string;
}

async function readSessionPayload(request?: NextRequest): Promise<SessionPayload | null> {
  let token: string | undefined;

  if (request) {
    token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7).trim();
      }
    }
  }

  if (!token) {
    try {
      const jar = await cookies();
      token = jar.get(SESSION_COOKIE)?.value;
    } catch {
      // outside request store context
    }
  }

  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await secretKey());
    if (typeof payload.sub !== "string") return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function readSessionUserId(request?: NextRequest) {
  const payload = await readSessionPayload(request);
  return payload?.sub ?? null;
}

/**
 * Require an authenticated user. First tries the file store for full profile
 * data; if unavailable (serverless cold start), reconstructs a usable profile
 * from the self-contained JWT and re-persists it to the store.
 */
export async function requireUser(request?: NextRequest): Promise<Profile> {
  const payload = await readSessionPayload(request);
  if (!payload || !payload.sub) {
    throw new Error("UNAUTHENTICATED");
  }

  // Try file store first for full profile (including passwordHash)
  try {
    const profile = await store.getProfile(payload.sub);
    if (profile) return profile;
  } catch {
    // Store read failed — likely cold start, fall through
  }

  const email = payload.email || `user-${payload.sub.slice(0, 8)}@ayuvsaathi.in`;
  const reconstructed: Profile = {
    id: payload.sub,
    email,
    passwordHash: "",
    displayName: payload.displayName || email.split("@")[0],
    interfaceLanguage: (payload.interfaceLanguage || "en") as Locale,
    aiLanguage: (payload.aiLanguage || "en") as Locale,
    timezone: payload.timezone || "Asia/Kolkata",
    notifyReminders: payload.notifyReminders ?? true,
    onboardingComplete: payload.onboardingComplete ?? false,
    emailVerified: payload.emailVerified ?? false,
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Persist to store so subsequent requests on same instance are fast
  try {
    await store.upsertProfile(reconstructed);
  } catch {
    // Ignore write failures — the reconstructed profile is still usable
  }

  return reconstructed;
}

export function publicProfile(profile: Profile) {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    interfaceLanguage: profile.interfaceLanguage,
    aiLanguage: profile.aiLanguage,
    timezone: profile.timezone,
    notifyReminders: profile.notifyReminders,
    onboardingComplete: profile.onboardingComplete,
    emailVerified: profile.emailVerified,
    createdAt: profile.createdAt,
  };
}