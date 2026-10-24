import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, createSession } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";
import { getDashboardForRole } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/db/types";

const schema = z.object({
  targetRole: z.enum(["patient", "doctor", "lab_tech", "pharmacist"]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Valid targetRole ('patient', 'doctor', 'lab_tech', 'pharmacist') is required.", 400);
    }

    const targetRole = parsed.data.targetRole as UserRole;

    // Check authorization for the target role
    if (targetRole === "doctor" && !user.doctorProfile && user.role !== "doctor") {
      return jsonError("Access denied: You do not have an active Doctor profile registered.", 403);
    }

    if (targetRole === "lab_tech" && !user.labTechProfile && user.role !== "lab_tech") {
      return jsonError("Access denied: You do not have an active Laboratory Technician profile registered.", 403);
    }

    if (targetRole === "pharmacist" && !user.pharmacistProfile && user.role !== "pharmacist") {
      return jsonError("Access denied: You do not have an active Pharmacist profile registered.", 403);
    }

    // Update user profile in database
    const updatedProfile = await store.upsertProfile({
      ...user,
      role: targetRole,
      updatedAt: new Date().toISOString(),
    });

    // Re-issue authoritative session cookie with updated role
    const { cookieHeader } = await createSession(updatedProfile);
    const locale = user.interfaceLanguage || "en";
    const redirectUrl = getDashboardForRole(targetRole, locale);

    const response = Response.json({
      ok: true,
      role: targetRole,
      redirectUrl,
      message: `Switched active domain to ${targetRole}`,
    });

    if (cookieHeader) {
      response.headers.set("set-cookie", cookieHeader);
    }

    return response;
  } catch {
    return jsonError("Unauthorized to switch role", 401);
  }
}
