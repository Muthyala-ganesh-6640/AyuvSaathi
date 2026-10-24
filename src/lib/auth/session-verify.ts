import { jwtVerify } from "jose";
import type { UserRole } from "@/lib/db/types";

export const SESSION_COOKIE = "arogya_session";

const FALLBACK_SECRET = "ayuvsaathi-super-secret-auth-key-2026-production-ready-companion";

export function getJwtSecretKey() {
  const secret = process.env.AUTH_SECRET || FALLBACK_SECRET;
  return new TextEncoder().encode(secret);
}

export interface VerifiedSession {
  userId: string;
  role: UserRole;
  email?: string;
  displayName?: string;
  locale?: string;
}

export async function verifyTokenString(token: string): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (typeof payload.sub !== "string") return null;

    const role = (typeof payload.role === "string" ? payload.role : "patient") as UserRole;
    const locale = typeof payload.interfaceLanguage === "string" ? payload.interfaceLanguage : "en";

    return {
      userId: payload.sub,
      role,
      email: typeof payload.email === "string" ? payload.email : undefined,
      displayName: typeof payload.displayName === "string" ? payload.displayName : undefined,
      locale,
    };
  } catch {
    return null;
  }
}
