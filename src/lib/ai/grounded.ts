import type { Observation, Medication, VisitSummary, MedicalDocument } from "@/lib/db/types";
import { compareToSourceRange } from "@/lib/medical/ranges";

export interface GroundedContext {
  observations: Observation[];
  medications?: Medication[];
  visits?: VisitSummary[];
  documents?: MedicalDocument[];
}

export function groundedAnswer(
  question: string,
  recordsOrObs: Observation[] | GroundedContext,
  _locale?: string
) {
  void _locale;
  const context: GroundedContext = Array.isArray(recordsOrObs)
    ? { observations: recordsOrObs }
    : recordsOrObs;

  const observations = context.observations || [];
  const medications = context.medications || [];
  const visits = context.visits || [];
  const documents = context.documents || [];

  const hasAnyData =
    observations.length > 0 || medications.length > 0 || visits.length > 0 || documents.length > 0;

  if (!hasAnyData) {
    return "I do not have any patient-confirmed records yet. Upload a lab report, prescription, or doctor summary first. This is not medical advice.";
  }

  const q = question.toLowerCase();

  // Deduplicate observations by name so duplicate records do not repeat
  const uniqueObsMap = new Map<string, Observation>();
  for (const o of observations) {
    const key = o.name.trim().toLowerCase();
    if (!uniqueObsMap.has(key)) {
      uniqueObsMap.set(key, o);
    }
  }
  const deduplicatedObs = Array.from(uniqueObsMap.values());

  const matchedObs = deduplicatedObs.filter((o) => {
    const name = o.name.toLowerCase();
    return q.includes(name) || name.split(/\s+/).some((part) => part.length > 3 && q.includes(part));
  });

  const matchedMeds = medications.filter((m) => {
    const name = m.name.toLowerCase();
    return q.includes(name) || name.split(/\s+/).some((part) => part.length > 3 && q.includes(part));
  });

  const matchedVisits = visits.filter((v) => {
    const title = (v.title || "").toLowerCase();
    const content = (v.content || "").toLowerCase();
    return (
      q.includes("doctor") ||
      q.includes("summary") ||
      q.includes("visit") ||
      q.includes("consult") ||
      q.includes("advice") ||
      (title && title.split(/\s+/).some((p) => p.length > 3 && q.includes(p))) ||
      (content && content.split(/\s+/).some((p) => p.length > 4 && q.includes(p)))
    );
  });

  const isAskingPrescription =
    q.includes("medicine") ||
    q.includes("prescription") ||
    q.includes("medication") ||
    q.includes("dose") ||
    q.includes("tablet") ||
    q.includes("pill") ||
    q.includes("timing") ||
    matchedMeds.length > 0;

  const isAskingDoctorSummary =
    q.includes("doctor") ||
    q.includes("summary") ||
    q.includes("discharge") ||
    q.includes("visit") ||
    q.includes("advice") ||
    q.includes("question") ||
    matchedVisits.length > 0;

  const responseSections: string[] = [];

  // 1. Lab Observations Section
  const obsPool = matchedObs.length
    ? matchedObs
    : !isAskingPrescription && !isAskingDoctorSummary
      ? deduplicatedObs.slice(0, 8)
      : [];

  if (obsPool.length) {
    const lines = obsPool.map((o) => {
      const status = compareToSourceRange(o.value, o.referenceRange);
      const range =
        o.referenceRange && o.referenceRange.trim()
          ? `source range ${o.referenceRange}`
          : "no source range provided";
      return `${o.name}: ${o.value} ${o.unit} (${range}; ${status.replaceAll("_", " ")})`;
    });
    responseSections.push(`Confirmed Lab Report Values:\n${lines.join("\n")}`);
  }

  // 2. Medications & Prescriptions Section
  const medPool = matchedMeds.length ? matchedMeds : isAskingPrescription ? medications : [];
  if (medPool.length) {
    const medLines = medPool.map((m) => {
      return `• ${m.name} (${m.strength}): ${m.instructions} [Status: ${m.status}]`;
    });
    responseSections.push(`Prescribed Medications & Dosages:\n${medLines.join("\n")}`);
  }

  // 3. Doctor Summaries & Visit Advice Section
  const visitPool = matchedVisits.length ? matchedVisits : isAskingDoctorSummary ? visits : [];
  if (visitPool.length) {
    const visitLines = visitPool.map((v) => {
      const qs = (v.questions && v.questions.length) ? `\n  Suggested Questions for Doctor: ${v.questions.join("; ")}` : "";
      return `• ${v.title || "Consultation Summary"}:\n  Notes: ${v.content || "No details provided"}${qs}`;
    });
    responseSections.push(`Doctor Consultation & Visit Summaries:\n${visitLines.join("\n")}`);
  }

  const intro = "These facts come only from values you confirmed. This is not a diagnosis.";
  const ask = "Ask a qualified clinician how these results relate to your symptoms and history.";

  if (!responseSections.length) {
    // General fallback listing all confirmed values
    const lines = deduplicatedObs.slice(0, 8).map((o) => {
      const status = compareToSourceRange(o.value, o.referenceRange);
      const range =
        o.referenceRange && o.referenceRange.trim()
          ? `source range ${o.referenceRange}`
          : "no source range provided";
      return `${o.name}: ${o.value} ${o.unit} (${range}; ${status.replaceAll("_", " ")})`;
    });

    const none = "No specific test in your question matched a confirmed result. Confirmed values:";
    return `${intro}\n${none}\n${lines.join("\n")}\n${ask}`;
  }

  return `${intro}\n${responseSections.join("\n\n")}\n${ask}`;
}
