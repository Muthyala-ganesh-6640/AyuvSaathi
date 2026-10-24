import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const { id, all } = body;

    if (all) {
      const count = await store.markAllNotificationsRead(user.id);
      return Response.json({ ok: true, markedCount: count });
    }

    if (!id || typeof id !== "string") {
      return jsonError("Notification ID is required", 400);
    }

    const success = await store.markNotificationRead(id, user.id);
    return Response.json({ ok: true, success });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}
