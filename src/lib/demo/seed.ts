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
  const docId = crypto.randomUUID();
  const obsId = crypto.randomUUID();
  const medId = crypto.randomUUID();
  const scheduleId = crypto.randomUUID();
  const visitId = crypto.randomUUID();
  const apptId = crypto.randomUUID();
  const trendMeasurements = [
    { name: "Fasting glucose", value: "104", unit: "mg/dL", monthsAgo: 2 },
    { name: "Blood pressure", value: "126/82", unit: "mmHg", monthsAgo: 2 },
    { name: "HbA1c", value: "5.8", unit: "%", monthsAgo: 2 },
    { name: "Fasting glucose", value: "98", unit: "mg/dL", monthsAgo: 1 },
    { name: "Blood pressure", value: "122/79", unit: "mmHg", monthsAgo: 1 },
    { name: "HbA1c", value: "5.6", unit: "%", monthsAgo: 1 },
    { name: "Fasting glucose", value: "101", unit: "mg/dL", monthsAgo: 0 },
    { name: "Blood pressure", value: "124/80", unit: "mmHg", monthsAgo: 0 },
    { name: "HbA1c", value: "5.7", unit: "%", monthsAgo: 0 },
  ];

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

  for (const measurement of trendMeasurements) {
    const sourceDate = new Date();
    sourceDate.setDate(1);
    sourceDate.setMonth(sourceDate.getMonth() - measurement.monthsAgo);
    await store.saveObservation({
      id: crypto.randomUUID(),
      ownerId: user.id,
      documentId: docId,
      name: measurement.name,
      value: measurement.value,
      unit: measurement.unit,
      sourceDate: sourceDate.toISOString().slice(0, 10),
      uncertain: false,
      verificationStatus: "confirmed",
      provenance: "synthetic_demo",
      createdAt: created,
      updatedAt: created,
    });
  }

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