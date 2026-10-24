import { NextRequest } from "next/server";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { publicProfile } from "@/lib/auth/session";
import { ensureUpcomingDoses } from "@/lib/medical/ensure-doses";
import { localDateKey } from "@/lib/medical/schedules";
import { serviceStatus } from "@/lib/env";
import { canAccessPatientData } from "@/lib/auth/authorization";
import { generateWellnessRecommendations } from "@/lib/medical/wellness";
import { seedSyntheticData } from "@/lib/demo/seed";

export async function GET(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const user = auth.user;
  await ensureUpcomingDoses(user);
  const tz = user.timezone || "Asia/Kolkata";
  const today = localDateKey(new Date(), tz);
  const requestedProfileId = request.nextUrl.searchParams.get("patientProfileId") || request.headers.get("x-patient-profile-id") || user.id;

  // Verify access if requested profile is not the primary user
  let activeProfileName = user.displayName;
  let activeAyuvSaathiId = user.ayuvSaathiId || `AS-P-${user.id.slice(0, 5).toUpperCase()}`;
  let activeRelationship = "self";

  if (requestedProfileId !== user.id) {
    const fam = await store.getFamilyMember(requestedProfileId);
    if (fam && fam.primaryUserId === user.id) {
      activeProfileName = fam.name;
      activeAyuvSaathiId = fam.ayuvSaathiId;
      activeRelationship = fam.relationship;
    } else {
      // Must be an authorized professional with an active collaboration connection
      const authCheck = await canAccessPatientData(user, requestedProfileId, "viewRecords");
      if (!authCheck.authorized) {
        return jsonError("Unauthorized to access this patient profile", 403);
      }
      const targetProfile = await store.getProfile(requestedProfileId);
      if (targetProfile) {
        activeProfileName = targetProfile.displayName;
        activeAyuvSaathiId = targetProfile.ayuvSaathiId || `AS-P-${targetProfile.id.slice(0, 5).toUpperCase()}`;
      }
    }
  }

  let [
    documents,
    medications,
    doses,
    timeline,
    appointments,
    observations,
    visits,
  ] = await Promise.all([
    store.listDocuments(requestedProfileId),
    store.listMedications(requestedProfileId),
    store.listDoses(requestedProfileId),
    store.listTimeline(requestedProfileId),
    store.listAppointments(requestedProfileId),
    store.listObservations(requestedProfileId),
    store.listVisits(requestedProfileId),
  ]);

  const [
    connections,
    pharmacyBills,
    prescriptions,
    familyMembers,
    notifications,
  ] = await Promise.all([
    store.listConnections(requestedProfileId),
    store.listPharmacyBills(requestedProfileId),
    store.listPrescriptions(requestedProfileId),
    store.listFamilyMembers(user.id),
    store.listNotifications(user.id, requestedProfileId),
  ]);

  // If this profile has zero documents and zero medications, automatically seed a demo dossier so the dashboard is immediately functional
  if (requestedProfileId === user.id && documents.length === 0 && medications.length === 0) {
    try {
      await seedSyntheticData(user);
      [documents, medications, doses, timeline, appointments, observations, visits] = await Promise.all([
        store.listDocuments(requestedProfileId),
        store.listMedications(requestedProfileId),
        store.listDoses(requestedProfileId),
        store.listTimeline(requestedProfileId),
        store.listAppointments(requestedProfileId),
        store.listObservations(requestedProfileId),
        store.listVisits(requestedProfileId),
      ]);
    } catch {
      // Continue gracefully
    }
  }

  const todaysDoses = doses
    .filter((d) => d.scheduledDate === today)
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  const medById = new Map(medications.map((m) => [m.id, m]));

  // Genuine categorizations
  const labReports = documents.filter(
    (d) => d.category === "lab_report" || d.category === "diagnostic_report"
  );
  const dischargeSummaries = documents.filter((d) => d.category === "discharge_summary");
  const doctorVisitDocs = documents.filter((d) => d.category === "doctor_visit");
  const prescriptionDocs = documents.filter((d) => d.category === "prescription");

  // Glucose observations for trend matching
  const glucoseObservations = observations
    .filter(
      (o) =>
        o.verificationStatus === "confirmed" &&
        (o.name.toLowerCase().includes("glucose") ||
          o.name.toLowerCase().includes("sugar") ||
          o.name.toLowerCase().includes("fasting"))
    )
    .sort((a, b) => (a.sourceDate || a.createdAt).localeCompare(b.sourceDate || b.createdAt));

  // Generate personalized wellness recommendations
  const wellnessAnalysis = generateWellnessRecommendations(
    user,
    observations,
    medications,
    prescriptions,
    visits
  );

  return Response.json({
    user: publicProfile(user),
    activeProfile: {
      id: requestedProfileId,
      name: activeProfileName,
      ayuvSaathiId: activeAyuvSaathiId,
      relationship: activeRelationship,
    },
    familyMembers,
    connections,
    pharmacyBills: pharmacyBills.slice(0, 5),
    prescriptions: prescriptions.slice(0, 5),
    notifications: notifications.slice(0, 10),
    unreadNotificationsCount: notifications.filter((n) => !n.read).length,
    services: serviceStatus(),
    today,
    medicines: todaysDoses.map((d) => ({
      ...d,
      medicationName: medById.get(d.medicationId)?.name ?? "Medicine",
      strength: medById.get(d.medicationId)?.strength ?? "",
      instructions: medById.get(d.medicationId)?.instructions ?? "",
      synthetic: medById.get(d.medicationId)?.provenance === "synthetic_demo",
    })),
    documents: documents.slice(0, 8),
    recentLabReports: labReports.slice(0, 5),
    recentDischargeSummaries: dischargeSummaries.slice(0, 5),
    recentDoctorVisitDocs: doctorVisitDocs.slice(0, 5),
    recentPrescriptionDocs: prescriptionDocs.slice(0, 5),
    recentMedications: medications.slice(0, 6),
    timeline: timeline.slice(0, 10),
    visits: visits.slice(0, 5),
    upcomingAppointments: appointments.filter((a) => a.status === "scheduled").slice(0, 4),
    observationCount: observations.filter((o) => o.verificationStatus === "confirmed").length,
    glucoseObservations: glucoseObservations.slice(-7),
    wellnessAnalysis,
    stats: {
      labReportsCount: labReports.length,
      remindersCount: todaysDoses.filter((d) => d.status === "pending").length,
      treatmentPlansCount: 0,
      medicalRecordsCount: documents.length,
    },
  });
}
