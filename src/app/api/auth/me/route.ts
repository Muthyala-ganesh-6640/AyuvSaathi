import { NextRequest } from "next/server";
import { requireUser, publicProfile } from "@/lib/auth/session";
import { jsonError } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    return Response.json({ ok: true, user: publicProfile(user) });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}
