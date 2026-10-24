import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";
import type { PatientQRToken } from "@/lib/db/types";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const searchParams = request.nextUrl.searchParams;
    const requestedProfileId = searchParams.get("profileId") || user.id;

    let patientName = user.displayName;
    let ayuvSaathiId = user.ayuvSaathiId || `AS-P-${user.id.slice(0, 5).toUpperCase()}`;

    // If requesting for a family member
    if (requestedProfileId !== user.id) {
      const familyMember = await store.getFamilyMember(requestedProfileId);
      if (!familyMember || familyMember.primaryUserId !== user.id) {
        return jsonError("Family profile not found", 404);
      }
      patientName = familyMember.name;
      ayuvSaathiId = familyMember.ayuvSaathiId;
    }

    // Ephemeral token expiring in 24 hours
    const tokenString = `ayuv_qr_${randomBytes(16).toString("hex")}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const qrToken: PatientQRToken = {
      token: tokenString,
      patientProfileId: requestedProfileId,
      primaryUserId: user.id,
      patientName,
      ayuvSaathiId,
      expiresAt,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    await store.createQRToken(qrToken);

    // Opaque URI containing only the token, never raw data
    const qrData = `ayuv://connect/t/${tokenString}`;

    return Response.json({
      ok: true,
      token: tokenString,
      qrData,
      patientProfileId: requestedProfileId,
      patientName,
      ayuvSaathiId,
      expiresAt,
    });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}
