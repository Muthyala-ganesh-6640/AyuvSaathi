import { NextRequest } from "next/server";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { canAccessPatientData } from "@/lib/auth/authorization";
import { generateWellnessRecommendations } from "@/lib/medical/wellness";

export async function GET(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const user = auth.user;
  const requestedProfileId =
    request.nextUrl.searchParams.get("patientProfileId") ||
    request.headers.get("x-patient-profile-id") ||
    user.id;

  let targetProfile = user;

  if (requestedProfileId !== user.id) {
    const fam = await store.getFamilyMember(requestedProfileId);
    if (fam && fam.primaryUserId === user.id) {
      targetProfile = {
        ...user,
        id: fam.id,
        displayName: fam.name,
        dateOfBirth: fam.dateOfBirth,
        gender: fam.gender,
        bloodGroup: fam.bloodGroup,
      };
    } else {
      const authCheck = await canAccessPatientData(user, requestedProfileId, "viewRecords");
      if (!authCheck.authorized) {
        return jsonError("Unauthorized to view wellness recommendations for this patient.", 403);
      }
      const p = await store.getProfile(requestedProfileId);
      if (p) targetProfile = p;
    }
  }

  const [observations, medications, prescriptions, visits] = await Promise.all([
    store.listObservations(requestedProfileId),
    store.listMedications(requestedProfileId),
    store.listPrescriptions(requestedProfileId),
    store.listVisits(requestedProfileId),
  ]);

  const analysis = generateWellnessRecommendations(
    targetProfile,
    observations,
    medications,
    prescriptions,
    visits
  );

  return Response.json({
    ok: true,
    patientProfileId: requestedProfileId,
    analysis,
  });
}
