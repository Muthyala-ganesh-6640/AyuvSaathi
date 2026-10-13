import { clearSession } from "@/lib/auth/session";

export async function POST() {
  const cookieHeader = await clearSession();
  const response = Response.json({ ok: true });
  if (cookieHeader) {
    response.headers.set("set-cookie", cookieHeader);
  }
  return response;
}
