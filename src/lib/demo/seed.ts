import { store } from "@/lib/db/file-store";
import type { Profile } from "@/lib/db/types";
import { nowIso } from "@/lib/utils";

export async function seedSyntheticData(user: Profile) {
  // Clean up any existing synthetic demo records for this user first to prevent duplicates
  const existingDocs = await store.listDocuments(user.id);
  for (const d of existingDocs) {
    if (d.displayName.startsWith("SYNTHETIC demo")) {
      await store.deleteDocument(d.id, user.id);
    }
  }

  const existingMeds = await store.listMedications(user.id);
  for (const m of existingMeds) {
    if (m.provenance === "synthetic_demo") {
      await store.deleteMedication(m.id, user.id);
    }
  }

  const created = nowIso();
  const baselineDate = new Date();
  baselineDate.setMonth(baselineDate.getMonth() - 2);
  const baselineDateStr = baselineDate.toISOString().slice(0, 10);

  const docBaselineId = crypto.randomUUID();
  const docId = crypto.randomUUID();
  const obsId = crypto.randomUUID();
  const medId = crypto.randomUUID();
  const medMetforminId = crypto.randomUUID();
  const scheduleId = crypto.randomUUID();
  const visitId = crypto.randomUUID();
  const apptId = crypto.randomUUID();

  // Baseline Diagnostic Report (2 months ago)
  await store.saveDocument({
    id: docBaselineId,
    ownerId: user.id,
    category: "lab_report",
    storagePath: "",
    displayName: "SYNTHETIC baseline lab report - Metabolic & Lipid Panel",
    mimeType: "application/pdf",
    fileSize: 0,
    uploadStatus: "uploaded",
    processingStatus: "extracted",
    sourceDate: baselineDateStr,
    createdAt: baselineDate.toISOString(),
    updatedAt: baselineDate.toISOString(),
  });

  // Current Follow-up Diagnostic Report
  await store.saveDocument({
    id: docId,
    ownerId: user.id,
    category: "lab_report",
    storagePath: "",
    displayName: "SYNTHETIC demo health metrics (not real results)",
    mimeType: "application/pdf",
    fileSize: 0,
    uploadStatus: "uploaded",
    processingStatus: "extracted",
    sourceDate: created.slice(0, 10),
    createdAt: created,
    updatedAt: created,
  });

  // Exact confirmed demo hemoglobin tested in test suites
  await store.saveObservation({
    id: obsId,
    ownerId: user.id,
    documentId: docId,
    name: "Hemoglobin",
    value: "13.4",
    unit: "g/dL",
    referenceRange: "12.0-15.0",
    sourceDate: created.slice(0, 10),
    uncertain: false,
    verificationStatus: "confirmed",
    provenance: "synthetic_demo",
    createdAt: created,
    updatedAt: created,
  });

  const trendMeasurements = [
    { docId: docBaselineId, name: "Fasting glucose", value: "104", unit: "mg/dL", monthsAgo: 2, range: "70-99" },
    { docId: docBaselineId, name: "Blood pressure", value: "126/82", unit: "mmHg", monthsAgo: 2, range: "90/60-120/80" },
    { docId: docBaselineId, name: "HbA1c", value: "5.8", unit: "%", monthsAgo: 2, range: "< 5.7" },
    { docId: docBaselineId, name: "Total Cholesterol", value: "215", unit: "mg/dL", monthsAgo: 2, range: "< 200" },
    { docId: docId, name: "Fasting glucose", value: "98", unit: "mg/dL", monthsAgo: 1, range: "70-99" },
    { docId: docId, name: "Blood pressure", value: "122/79", unit: "mmHg", monthsAgo: 1, range: "90/60-120/80" },
    { docId: docId, name: "HbA1c", value: "5.6", unit: "%", monthsAgo: 1, range: "< 5.7" },
    { docId: docId, name: "Total Cholesterol", value: "192", unit: "mg/dL", monthsAgo: 1, range: "< 200" },
    { docId: docId, name: "Fasting glucose", value: "101", unit: "mg/dL", monthsAgo: 0, range: "70-99" },
    { docId: docId, name: "Blood pressure", value: "124/80", unit: "mmHg", monthsAgo: 0, range: "90/60-120/80" },
    { docId: docId, name: "HbA1c", value: "5.7", unit: "%", monthsAgo: 0, range: "< 5.7" },
  ];

  await Promise.all(
    trendMeasurements.map(async (m) => {
      const sourceDate = new Date();
      sourceDate.setDate(1);
      sourceDate.setMonth(sourceDate.getMonth() - m.monthsAgo);
      const dateStr = sourceDate.toISOString().slice(0, 10);
      await store.saveObservation({
        id: crypto.randomUUID(),
        ownerId: user.id,
        documentId: m.docId,
        name: m.name,
        value: m.value,
        unit: m.unit,
        referenceRange: m.range,
        sourceDate: dateStr,
        uncertain: false,
        verificationStatus: "confirmed",
        provenance: "synthetic_demo",
        createdAt: dateStr + "T10:00:00Z",
        updatedAt: dateStr + "T10:00:00Z",
      });
    })
  );

  await store.saveMedication({
    id: medId,
    ownerId: user.id,
    name: "Demo Vitamin D3 (synthetic)",
    strength: "1000 IU",
    instructions: "Once daily after food — synthetic example, not a prescription",
    route: "oral",
    status: "active",
    confirmationStatus: "confirmed",
    provenance: "synthetic_demo",
    createdAt: created,
    updatedAt: created,
  });

  await store.saveMedication({
    id: medMetforminId,
    ownerId: user.id,
    name: "Demo Metformin (synthetic)",
    strength: "500 mg",
    instructions: "Once daily with dinner — synthetic example",
    route: "oral",
    status: "active",
    confirmationStatus: "confirmed",
    provenance: "synthetic_demo",
    createdAt: created,
    updatedAt: created,
  });

  await store.saveSchedule({
    id: scheduleId,
    medicationId: medId,
    ownerId: user.id,
    times: ["09:00"],
    timezone: user.timezone,
    startDate: created.slice(0, 10),
    enabled: true,
    createdAt: created,
    updatedAt: created,
  });

  await store.saveVisit({
    id: visitId,
    ownerId: user.id,
    title: "SYNTHETIC visit checklist",
    sourceIds: [obsId, medId],
    content:
      "Synthetic example only. Confirmed demo hemoglobin 13.4 g/dL (source range 12.0-15.0). Ask the clinician whether any real tests are needed.",
    questions: ["What follow-up tests, if any, are appropriate for my actual symptoms?"],
    createdAt: created,
    updatedAt: created,
  });

  const start = new Date();
  start.setDate(start.getDate() + 3);
  await store.saveAppointment({
    id: apptId,
    ownerId: user.id,
    title: "SYNTHETIC follow-up reminder",
    facility: "Example clinic (not a real booking)",
    startsAt: start.toISOString(),
    timezone: user.timezone,
    status: "scheduled",
    notes: "This appointment is sample data for demonstration.",
    createdAt: created,
    updatedAt: created,
  });

  await store.addTimeline({
    id: crypto.randomUUID(),
    ownerId: user.id,
    type: "document",
    relatedId: docId,
    eventDate: created,
    summary: "Synthetic demo report added (labeled sample data).",
    provenance: "synthetic_demo",
    createdAt: created,
  });
}