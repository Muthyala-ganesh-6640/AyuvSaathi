import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const searchParams = request.nextUrl.searchParams;
    const patientProfileId = searchParams.get("patientProfileId") || undefined;

    const notifications = await store.listNotifications(user.id, patientProfileId);
    return Response.json({ ok: true, notifications });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}
