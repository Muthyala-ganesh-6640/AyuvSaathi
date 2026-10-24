import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    // Case 1: Fetch single patient's detailed shared healthcare record
    if (patientId) {
      let patientInfo: {
        id: string;
        name: string;
        email?: string;
        ayuvSaathiId: string;
        relationship: string;
        emergencyContact?: string;
        bloodGroup?: string;
      } | null = null;

      const profile = await store.getProfile(patientId);
      if (profile) {
        patientInfo = {
          id: profile.id,
          name: profile.displayName || "Patient",
          email: profile.email,
          ayuvSaathiId: profile.ayuvSaathiId || `AYUV-${profile.id.slice(0, 6).toUpperCase()}`,
          relationship: "self",
        };
      } else {
        const fam = await store.getFamilyMember(patientId);
        if (fam) {
          patientInfo = {
            id: fam.id,
            name: fam.name,
            ayuvSaathiId: fam.ayuvSaathiId,
            relationship: fam.relationship,
            emergencyContact: fam.emergencyContact,
            bloodGroup: fam.bloodGroup,
          };
        }
      }

      if (!patientInfo) {
        // Fallback: create placeholder identity if patientId exists in docs
        patientInfo = {
          id: patientId,
          name: "Authorized Patient",
          ayuvSaathiId: `AYUV-${patientId.slice(0, 6).toUpperCase()}`,
          relationship: "self",
        };
      }

      // Fetch all medical data in parallel
      const [allDocs, obs, meds, prescriptions, timeline, bills] = await Promise.all([
        store.listDocuments(patientId).catch(() => []),
        store.listObservations(patientId).catch(() => []),
        store.listMedications(patientId).catch(() => []),
        store.listPrescriptions(patientId).catch(() => []),
        store.listTimeline(patientId).catch(() => []),
        store.listPharmacyBills(patientId).catch(() => []),
      ]);

      const labReports = allDocs.filter((d) => d.category === "lab_report");
      const doctorSummaries = allDocs.filter((d) => d.category === "doctor_visit" || d.category === "discharge_summary");

      return Response.json({
        ok: true,
        patient: patientInfo,
        documents: allDocs,
        labReports,
        doctorSummaries,
        observations: obs,
        medications: meds,
        prescriptions,
        timeline,
        bills,
      });
    }

    // Case 2: List all accessible patient profiles
    const profiles = await store.listProfiles();
    const patientProfiles = profiles.filter((p) => !p.role || p.role === "patient");

    const patientsList = await Promise.all(
      patientProfiles.map(async (p) => {
        const [docs, prescriptions] = await Promise.all([
          store.listDocuments(p.id).catch(() => []),
          store.listPrescriptions(p.id).catch(() => []),
        ]);
        const labReports = docs.filter((d) => d.category === "lab_report");

        // Also fetch family members under this patient
        const family = await store.listFamilyMembers(p.id).catch(() => []);

        return {
          id: p.id,
          name: p.displayName || p.email.split("@")[0],
          email: p.email,
          ayuvSaathiId: p.ayuvSaathiId || `AYUV-${p.id.slice(0, 6).toUpperCase()}`,
          relationship: "self",
          documentsCount: docs.length,
          labReportsCount: labReports.length,
          prescriptionsCount: prescriptions.length,
          familyMembersCount: family.length,
          lastUpdated: docs[0]?.createdAt || p.updatedAt || p.createdAt,
          familyMembers: family.map((f) => ({
            id: f.id,
            name: f.name,
            ayuvSaathiId: f.ayuvSaathiId,
            relationship: f.relationship,
          })),
        };
      }),
    );

    return Response.json({
      ok: true,
      patients: patientsList,
    });
  } catch (error) {
    console.error("Failed to list professional patients:", error);
    return jsonError("Unauthorized or internal error", 500);
  }
}
