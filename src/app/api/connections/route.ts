import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const searchParams = request.nextUrl.searchParams;
    const patientProfileId = searchParams.get("patientProfileId") || user.id;

    if (user.role && user.role !== "patient") {
      const connections = await store.listProfessionalConnections(user.id);
      return Response.json({ ok: true, connections });
    }

    const connections = await store.listConnections(patientProfileId);
    return Response.json({ ok: true, connections });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}
