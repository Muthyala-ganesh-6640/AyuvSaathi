import type { Observation, Medication, VisitSummary, MedicalDocument } from "@/lib/db/types";
import { compareToSourceRange } from "@/lib/medical/ranges";
import { validateMedicalQuery } from "./guardrails";

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
  const context: GroundedContext = Array.isArray(recordsOrObs)
    ? { observations: recordsOrObs }
    : recordsOrObs;

  const observations = context.observations || [];
  const medications = context.medications || [];
  const visits = context.visits || [];
  const documents = context.documents || [];

  const contextStr = [
    ...observations.map((o) => `${o.name} ${o.value} ${o.unit || ""}`),
    ...medications.map((m) => `${m.name} ${m.strength || ""} ${m.instructions || ""}`),
    ...documents.map((d) => `${d.displayName} ${d.category}`),
    ...visits.map((v) => `${v.title || ""} ${v.content || ""}`),
  ].join(" ");

  // Pre-flight clinical guardrail check
  const guardrail = validateMedicalQuery(question, _locale, contextStr);
  if (!guardrail.isMedical) {
    return guardrail.refusalMessage;
  }

  // Handle polite greetings directly
  if (guardrail.category === "general_greeting") {
    if (_locale === "te") {
      return "నమస్కారం! నేను మీ ఆయువ్‌సాథి మెడికల్ ఏఐ అసిస్టెంట్‌ని. మీ మెడికల్ ల్యాబ్ రిపోర్టులు, ప్రిస్క్రిప్షన్లు, మందులు మరియు ఆరోగ్య రికార్డులను అర్థం చేసుకోవడానికి నేను సిద్ధంగా ఉన్నాను. ఈరోజు మీకు ఎలా సహాయపడాలి?";
    }
    if (_locale === "hi") {
      return "नमस्ते! मैं आपका आयुवसाथी क्लिनिकल एआई सहायक हूँ। मैं आपकी अपलोड की गई मेडिकल रिपोर्ट, पर्चे (प्रिस्क्रिप्शन), दवाओं और स्वास्थ्य रिकॉर्ड को समझने में आपकी मदद के लिए उपस्थित हूँ। आज मैं आपकी क्या सहायता कर सकता हूँ?";
    }
    return "Hello! I am your AyuvSaathi Clinical Health Assistant. I am here to help you understand your uploaded medical lab reports, prescriptions, medications, and health records. How can I assist you today?";
  }

  const hasAnyData =
    observations.length > 0 || medications.length > 0 || visits.length > 0 || documents.length > 0;

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

  const isHeamoglobinQuery =
    q.includes("heamoglobin") ||
    q.includes("haemoglobin") ||
    q.includes("hemoglobin") ||
    q.includes("hb") ||
    q.includes("హిమోగ్లోబిన్") ||
    q.includes("हीमोग्लोबिन");

  const matchedObs = deduplicatedObs.filter((o) => {
    const name = o.name.toLowerCase();
    if (isHeamoglobinQuery && (name.includes("hemoglobin") || name.includes("haemoglobin") || name.includes("hb"))) {
      return true;
    }
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

  const isAskingDoloOrParacetamol =
    q.includes("dolo") ||
    q.includes("dolo 650") ||
    q.includes("paracetamol") ||
    q.includes("crocin") ||
    q.includes("calpol") ||
    q.includes("combiflam");

  const isAskingPrescription =
    isAskingDoloOrParacetamol ||
    q.includes("medicine") ||
    q.includes("prescription") ||
    q.includes("medication") ||
    q.includes("dose") ||
    q.includes("dosage") ||
    q.includes("tablet") ||
    q.includes("pill") ||
    q.includes("timing") ||
    q.includes("rx") ||
    q.includes("usage") ||
    q.includes("use of") ||
    q.includes("side effect") ||
    q.includes("ప్రిస్క్రిప్షన్") ||
    q.includes("మందులు") ||
    q.includes("మందు") ||
    q.includes("మాత్రలు") ||
    q.includes("पर्चा") ||
    q.includes("दवा") ||
    q.includes("दवाएं") ||
    q.includes("दवाइयां") ||
    matchedMeds.length > 0;

  const isAskingDoctorSummary =
    q.includes("doctor") ||
    q.includes("summary") ||
    q.includes("discharge") ||
    q.includes("visit") ||
    q.includes("advice") ||
    q.includes("question") ||
    q.includes("సలహా") ||
    q.includes("सलाह") ||
    matchedVisits.length > 0;

  const isAskingGeneralRecords =
    q.includes("record") ||
    q.includes("health records") ||
    q.includes("medical records") ||
    q.includes("my records") ||
    q.includes("all records") ||
    q.includes("overview") ||
    q.includes("రకార్డులు") ||
    q.includes("రికార్డు") ||
    q.includes("రికార్డులు") ||
    q.includes("రిపోర్టులు") ||
    q.includes("రిపోర్ట్") ||
    q.includes("రికార్డ్") ||
    q.includes("रिकॉर्ड") ||
    q.includes("रिकॉर्ड्स");

  const responseSections: string[] = [];

  // Clinical Knowledge Injection for common queries
  if (isAskingDoloOrParacetamol) {
    responseSections.push(
      `Medical Information on Dolo 650 / Paracetamol:\n` +
      `• Active Ingredient: Paracetamol (Acetaminophen) 650 mg.\n` +
      `• Primary Uses: Antipyretic (reduces fever) and Analgesic (relieves mild to moderate pain including headache, body ache, muscle pain, and joint pain).\n` +
      `• Standard Usage & Dosage: Typically 1 tablet every 4 to 6 hours as needed with water. Do not exceed 4 tablets (2600 mg) in 24 hours to prevent liver strain.\n` +
      `• Important Precautions: Avoid alcohol while taking paracetamol. If fever or pain persists beyond 3 days, consult your physician.`
    );
  } else if (isHeamoglobinQuery && (q.includes("what is") || q.includes("meaning") || q.includes("explain") || q.includes("ఎంత") || q.includes("क्या है"))) {
    responseSections.push(
      `Medical Explanation of Hemoglobin (Hb):\n` +
      `• Hemoglobin is an essential iron-containing protein found in your red blood cells (RBCs). It is responsible for binding oxygen in the lungs and transporting it throughout your body's tissues and organs.\n` +
      `• Typical Standard Reference Ranges: Adult males 13.5 - 17.5 g/dL; Adult females 12.0 - 15.5 g/dL.\n` +
      `• Clinical Relevance: Lower levels may indicate anemia, iron deficiency, or fatigue; elevated levels can occur with dehydration or living at high altitudes.`
    );
  }

  // 1. Lab Observations Section
  const obsPool = matchedObs.length
    ? matchedObs
    : isAskingGeneralRecords || (!isAskingPrescription && !isAskingDoctorSummary && !isAskingDoloOrParacetamol)
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
    responseSections.push(`Confirmed Lab Report Values from Your Records:\n${lines.join("\n")}`);
  }

  // 2. Medications & Prescriptions Section
  const medPool = matchedMeds.length
    ? matchedMeds
    : (isAskingPrescription || isAskingGeneralRecords)
      ? medications
      : [];

  if (medPool.length) {
    const medLines = medPool.map((m) => {
      return `• ${m.name} (${m.strength}): ${m.instructions} [Status: ${m.status}]`;
    });
    responseSections.push(`Prescribed Medications & Dosages from Your Records:\n${medLines.join("\n")}`);
  }

  // 3. Doctor Summaries & Visit Advice Section
  const visitPool = matchedVisits.length
    ? matchedVisits
    : (isAskingDoctorSummary || isAskingGeneralRecords)
      ? visits
      : [];

  if (visitPool.length) {
    const visitLines = visitPool.map((v) => {
      const qs = (v.questions && v.questions.length) ? `\n  Suggested Questions for Doctor: ${v.questions.join("; ")}` : "";
      return `• ${v.title || "Consultation Summary"}:\n  Notes: ${v.content || "No details provided"}${qs}`;
    });
    responseSections.push(`Doctor Consultation & Visit Summaries from Your Records:\n${visitLines.join("\n")}`);
  }

  if (!hasAnyData && !responseSections.length) {
    return "I do not have any patient-confirmed records yet. Upload a lab report, prescription, or doctor summary first. This is not medical advice.";
  }

  const intro = "These facts come only from values you confirmed. This is not a diagnosis.";
  const ask = "Ask a qualified clinician how these results relate to your symptoms and history.";

  if (!responseSections.length) {
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

  return `${intro}\n\n${responseSections.join("\n\n")}\n\n${ask}`;
}
