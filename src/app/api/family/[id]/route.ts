import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const ok = await store.deleteFamilyMember(id, user.id);
    if (!ok) {
      return jsonError("Family member not found or already deleted", 404);
    }
    return Response.json({ ok: true, deletedId: id });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}
