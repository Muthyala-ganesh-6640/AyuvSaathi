import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";
import { routing } from "@/i18n/routing";
import { isAiConfigured } from "@/lib/env";
import { assistantReply } from "@/lib/ai/provider";
import { groundedAnswer } from "@/lib/ai/grounded";
import { compareToSourceRange } from "@/lib/medical/ranges";
import { validateMedicalQuery } from "@/lib/ai/guardrails";

const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  language: z.enum(routing.locales).optional().default(routing.defaultLocale),
});

export async function POST(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const parsed = chatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Please enter a question.", 400);

  // Load all patient medical records across all domains in parallel
  const [observations, medications, schedules, documents, visits, timeline] = await Promise.all([
    store.listObservations(auth.user.id),
    store.listMedications(auth.user.id),
    store.listSchedules(auth.user.id),
    store.listDocuments(auth.user.id),
    store.listVisits(auth.user.id),
    store.listTimeline(auth.user.id),
  ]);

  // Load structured extractions for documents (discharge summaries, prescriptions, lab reports)
  const extractions = (
    await Promise.all(
      documents.map(async (doc) => {
        const docExts = await store.listExtractions(doc.id, auth.user.id);
        return docExts.map((e) => ({ ...e, docName: doc.displayName, docCategory: doc.category }));
      })
    )
  ).flat();

  const docMap = new Map(documents.map((d) => [d.id, d.displayName]));
  const scheduleMap = new Map(schedules.map((s) => [s.medicationId, s.times.join(", ")]));

  // 1. Lab Reports & Diagnostic Observations
  const labSections = observations.map((o) => {
    const range = o.referenceRange ? `Reference Range: ${o.referenceRange}` : "No reference range in report";
    const status = compareToSourceRange(o.value, o.referenceRange);
    const docName = docMap.get(o.documentId) || "Uploaded Lab Report";
    const date = o.sourceDate || o.createdAt.slice(0, 10);
    const clinicalFlag =
      status === "in_range"
        ? "NORMAL (within expected reference range)"
        : status === "out_of_range"
          ? "OUT OF RANGE / ABNORMAL"
          : "Range Not Stated";
    return `• [Report: "${docName}" | Date: ${date}] Test: ${o.name} = ${o.value} ${o.unit} (${range} | Status: ${clinicalFlag} | Verification: ${o.verificationStatus})`;
  });

  // 2. Prescriptions, Medications & Dosage Schedules
  const medSections = medications.map((m) => {
    const times = scheduleMap.get(m.id);
    const scheduleStr = times ? ` | Daily Reminder Times: ${times}` : "";
    return `• Medicine: ${m.name} (${m.strength}) | Route: ${m.route || "oral"} | Prescribed Instructions: ${m.instructions}${scheduleStr} | Status: ${m.status} | Verification: ${m.confirmationStatus}`;
  });

  // 3. Doctor Visit Summaries & Consultations
  const visitSections = visits.map((v) => {
    const questions = v.questions.length ? `\n    - Questions to ask Doctor: ${v.questions.join("; ")}` : "";
    return `• Consultation: "${v.title}" (Date: ${v.createdAt.slice(0, 10)})\n    - Doctor's Notes & Advice: ${v.content}${questions}`;
  });

  // 4. Clinical Extractions from Discharge Summaries & Documents
  const extractionSections = extractions.map((e) => {
    const s = e.structured as Record<string, unknown>;
    const hospital = s.hospitalName ? `Hospital: ${s.hospitalName} | ` : "";
    const doctor = s.doctorName || s.prescriberName ? `Doctor: ${s.doctorName || s.prescriberName} | ` : "";
    const diagnosis = s.diagnosis || s.diagnoses ? `\n    - Diagnoses / Findings: ${JSON.stringify(s.diagnosis || s.diagnoses)}` : "";
    const summary = s.summary ? `\n    - Clinical Summary: ${s.summary}` : "";
    const instructions = s.instructions || s.followUpInstructions ? `\n    - Follow-up Instructions: ${JSON.stringify(s.instructions || s.followUpInstructions)}` : "";
    return `• Extracted Clinical Record [Document: "${e.docName}" (${e.docCategory})]: ${hospital}${doctor}${diagnosis}${summary}${instructions}`;
  });

  // 5. Recent Chronological Health Events
  const timelineSections = timeline.slice(0, 6).map((t) => {
    return `• [${t.eventDate.slice(0, 10)}] (${t.type}): ${t.summary}`;
  });

  // Assemble the unified patient dossier
  const dossierBlocks: string[] = [];
  if (labSections.length) {
    dossierBlocks.push(`=== 1. UPLOADED LAB REPORTS & BIOMARKER TESTS ===\n${labSections.join("\n")}`);
  }
  if (medSections.length) {
    dossierBlocks.push(`=== 2. PRESCRIPTIONS & ACTIVE MEDICATIONS ===\n${medSections.join("\n")}`);
  }
  if (visitSections.length) {
    dossierBlocks.push(`=== 3. DOCTOR CONSULTATION SUMMARIES & ADVICE ===\n${visitSections.join("\n")}`);
  }
  if (extractionSections.length) {
    dossierBlocks.push(`=== 4. DISCHARGE SUMMARIES & DOCUMENT FINDINGS ===\n${extractionSections.join("\n")}`);
  }
  if (timelineSections.length) {
    dossierBlocks.push(`=== 5. PATIENT HEALTH TIMELINE & RECENT EVENTS ===\n${timelineSections.join("\n")}`);
  }

  const fullRecordsDossier = dossierBlocks.length
    ? dossierBlocks.join("\n\n")
    : "No medical documents, lab reports, or prescriptions uploaded yet.";

  const conversationId = parsed.data.conversationId ?? crypto.randomUUID();
  const now = nowIso();

  // Assemble patient context tokens to validate queries mentioning unique patient medical data
  const patientContextSummary = [
    ...documents.map((d) => d.displayName),
    ...medications.map((m) => m.name),
    ...observations.map((o) => o.name),
    ...visits.map((v) => v.title),
  ].join(" ");

  // Pre-flight Clinical Guardrail Check: Restrict to healthcare and patient records only
  const guardrail = validateMedicalQuery(
    parsed.data.message,
    parsed.data.language,
    patientContextSummary
  );

  // If query is non-medical, immediately reject without calling AI or leaking health records
  if (!guardrail.isMedical) {
    const existingConv = parsed.data.conversationId
      ? await store.getConversation(parsed.data.conversationId, auth.user.id)
      : null;

    if (!existingConv) {
      await store.saveConversation({
        id: conversationId,
        ownerId: auth.user.id,
        language: parsed.data.language,
        title: parsed.data.message.slice(0, 40) + "...",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await store.saveConversation({
        ...existingConv,
        updatedAt: now,
      });
    }

    // Record user query
    await store.addMessage({
      id: crypto.randomUUID(),
      conversationId,
      ownerId: auth.user.id,
      role: "user",
      content: parsed.data.message,
      sourceRefs: [],
      createdAt: now,
    });

    // Record assistant guardrail refusal
    const assistantNow = nowIso();
    const assistantMsg = await store.addMessage({
      id: crypto.randomUUID(),
      conversationId,
      ownerId: auth.user.id,
      role: "assistant",
      content: guardrail.refusalMessage,
      sourceRefs: [],
      createdAt: assistantNow,
    });

    return Response.json({
      conversationId,
      message: assistantMsg,
      caution: "Clinical Guardrail: Restricted to healthcare and uploaded medical records.",
    });
  }

  // Load message history for multi-turn conversation
  const previousMessages = await store.listMessages(conversationId, auth.user.id);
  const history = previousMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let replyText = "";
  let caution = "Grounded in your uploaded lab reports, doctor summaries, and prescriptions.";
  let usedRecordIds: string[] = [];

  const groundedContext = {
    observations,
    medications,
    visits,
    documents,
  };

  if (isAiConfigured()) {
    try {
      const res = await assistantReply({
        language: parsed.data.language || "en",
        question: parsed.data.message,
        history: history.slice(-10),
        records: fullRecordsDossier,
      });
      replyText = res.reply;
      caution = res.caution ? "Clinical caution: Strictly informational, verify with clinician." : "";
      usedRecordIds = res.usedRecordIds;
    } catch (error) {
      console.error("[Assistant Chat] AI request failed, falling back to grounded:", error);
      replyText = groundedAnswer(parsed.data.message, groundedContext, parsed.data.language || "en");
      caution = "Answer generated using patient health records analysis.";
    }
  } else {
    // Deterministic grounded response synthesizing lab results, medications, and doctor notes
    replyText = groundedAnswer(parsed.data.message, groundedContext, parsed.data.language || "en");
    caution = "AI provider is not configured. Answer is synthesized from uploaded medical records.";
  }

  // Ensure conversation record is persisted
  const existingConv = parsed.data.conversationId
    ? await store.getConversation(parsed.data.conversationId, auth.user.id)
    : null;

  if (!existingConv) {
    await store.saveConversation({
      id: conversationId,
      ownerId: auth.user.id,
      language: parsed.data.language,
      title: parsed.data.message.slice(0, 40) + "...",
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await store.saveConversation({
      ...existingConv,
      updatedAt: now,
    });
  }

  // Record user query
  await store.addMessage({
    id: crypto.randomUUID(),
    conversationId,
    ownerId: auth.user.id,
    role: "user",
    content: parsed.data.message,
    sourceRefs: [],
    createdAt: now,
  });

  // Record assistant response
  const assistantNow = nowIso();
  const assistantMsg = await store.addMessage({
    id: crypto.randomUUID(),
    conversationId,
    ownerId: auth.user.id,
    role: "assistant",
    content: replyText,
    sourceRefs: usedRecordIds,
    createdAt: assistantNow,
  });

  return Response.json({
    conversationId,
    message: assistantMsg,
    caution,
  });
}
