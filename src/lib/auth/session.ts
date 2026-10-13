import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { getEnv } from "@/lib/env";
import { getDataDir, store } from "@/lib/db/file-store";
import type { Profile } from "@/lib/db/types";

export const SESSION_COOKIE = "arogya_session";

let fallbackInMemorySecret: string | null = null;

async function secretKey() {
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

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(await secretKey());
  const jar = await cookies();
  const isHttps =
    process.env.COOKIE_SECURE === "true" ||
    (process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https://");
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 0,
  });
}

export async function readSessionUserId() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await secretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<Profile> {
  const id = await readSessionUserId();
  if (!id) {
    const error = new Error("UNAUTHENTICATED");
    throw error;
  }
  const profile = await store.getProfile(id);
  if (!profile) {
    throw new Error("UNAUTHENTICATED");
  }
  return profile;
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