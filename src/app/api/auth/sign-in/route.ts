import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { jsonError, limitOrThrow } from "@/lib/api";
import { clientIp } from "@/lib/utils";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1") || process.env.NODE_ENV !== "production";
  if (!isLocal) {
    const limited = limitOrThrow(`signin:${clientIp(request.headers)}`, 20, 15 * 60_000);
    if (limited) return limited;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter a valid email and password.", 400);

  const emailLower = parsed.data.email.toLowerCase().trim();
  const profile = await store.getProfileByEmail(emailLower);
  
  if (!profile || !(await verifyPassword(parsed.data.password, profile.passwordHash))) {
    return jsonError("Email or password is incorrect.", 401);
  }

  await createSession(profile.id);
  return Response.json({ ok: true, language: profile.interfaceLanguage });
}
