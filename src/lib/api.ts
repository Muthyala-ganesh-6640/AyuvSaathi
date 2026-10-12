import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import type { Profile } from "@/lib/db/types";
import { clientIp } from "@/lib/utils";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export async function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function withUser(request: NextRequest): Promise<
  { user: Profile; ip: string } | { response: Response }
> {
  try {
    const user = await requireUser();
    return { user, ip: clientIp(request.headers) };
  } catch {
    return { response: await jsonError("Please sign in to continue.", 401) };
  }
}

export function limitOrThrow(key: string, limit: number, windowMs: number) {
  const result = rateLimit(key, limit, windowMs);
  if (!result.ok) return rateLimitResponse(result.retryAfterMs ?? 60_000);
  return null;
}
