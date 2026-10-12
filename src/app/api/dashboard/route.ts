import { NextRequest } from "next/server";
import { store } from "@/lib/db/file-store";
import { withUser } from "@/lib/api";
import { publicProfile } from "@/lib/auth/session";
import { ensureUpcomingDoses } from "@/lib/medical/ensure-doses";
import { localDateKey } from "@/lib/medical/schedules";
import { serviceStatus } from "@/lib/env";

export async function GET(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const user = auth.user;
  await ensureUpcomingDoses(user);
  const tz = user.timezone || "Asia/Kolkata";
  const today = localDateKey(new Date(), tz);
  const [documents, medications, doses, timeline, appointments, observations, visits] = await Promise.all([
    store.listDocuments(user.id),
    store.listMedications(user.id),
    store.listDoses(user.id),
    store.listTimeline(user.id),
    store.listAppointments(user.id),
    store.listObservations(user.id),
    store.listVisits(user.id),
  ]);
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

  return Response.json({
    user: publicProfile(user),
    services: serviceStatus(),
    today,
    medicines: todaysDoses.map((d) => ({
      ...d,
      medicationName: medById.get(d.medicationId)?.name ?? "Medicine",
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
    stats: {
      labReportsCount: labReports.length,
      remindersCount: todaysDoses.filter((d) => d.status === "pending").length,
      treatmentPlansCount: 0,
      medicalRecordsCount: documents.length,
    },
  });
}