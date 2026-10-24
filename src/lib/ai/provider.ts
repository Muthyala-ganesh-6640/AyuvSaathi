import { getEnv, isAiConfigured } from "@/lib/env";
import {
  assistantOutputSchema,
  extractionSchema,
  type ExtractionPayload,
} from "./schemas";

const SYSTEM_SAFETY = `You are AyuvSaathi Health Assistant, a compassionate, accurate, and multilingual personal clinical health companion.
Your mission is to help patients clearly understand their uploaded medical lab reports, doctor consultation summaries, prescriptions, and health records in English, Telugu (తెలుగు), or Hindi (हिन्दी).
Clinical Safety Rules:
1. Grounding in Patient Records: You have full access to the patient's uploaded and confirmed health records (lab observations with values and reference ranges, prescriptions with dosages and daily timings, doctor visit summaries, and hospital discharge reports). When the patient asks about their health, test results, medicines, or doctor notes, reference these exact records directly and clearly explain what the reports state.
2. Transparency: Always cite the specific test name, measured value, units, source range, or doctor's written instructions when answering questions about their reports.
3. Patient Education vs. Medical Advice: Explain what lab tests mean, whether values fall within standard laboratory reference ranges (normal, elevated, or low), and what medications are commonly prescribed for. Do not formulate new diagnoses or alter prescribed treatment regimens without clinical supervision. Always encourage discussing abnormal findings with their treating physician.
4. Emergency Red-Flag Triage: If the user reports acute emergency symptoms (severe chest pain, breathing difficulty, sudden weakness, uncontrolled bleeding), advise them to immediately contact emergency medical services (108 / 112 in India).
5. Multilingual Fluency: Respond fluently and naturally in the requested language (English, Telugu, or Hindi) while preserving medicine names, dosages, units, and numeric values accurately.
6. Strict Medical Guardrails & Domain Restriction: You are exclusively a medical and healthcare assistant. You MUST decline all non-medical queries, including coding/programming, non-medical trivia, creative writing, entertainment, financial or crypto advice, and political questions. Politely explain that AyuvSaathi is exclusively dedicated to healthcare, medical reports, prescriptions, and health education.`;

function endpoint(): string {
  const env = getEnv();
  const provider = (env.AI_PROVIDER ?? "openai").toLowerCase();

  if (env.AI_BASE_URL) {
    const baseUrl = env.AI_BASE_URL.replace(/\/+$/, "");
    return baseUrl.endsWith("/chat/completions")
      ? baseUrl
      : `${baseUrl}/chat/completions`;
  }

  if (provider === "groq") {
    return "https://api.groq.com/openai/v1/chat/completions";
  }

  if (provider === "anthropic") {
    return "https://api.anthropic.com/v1/messages";
  }

  return "https://api.openai.com/v1/chat/completions";
}

function modelName(): string {
  const env = getEnv();
  return env.AI_MODEL || "gpt-4o-mini";
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type PrescriptionImage = {
  mimeType: "image/jpeg" | "image/png";
  base64: string;
};

async function providerError(response: Response): Promise<Error> {
  const body = await response.text().catch(() => "");
  let detail = "";

  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: unknown; code?: unknown };
    };
    const message =
      typeof parsed.error?.message === "string" ? parsed.error.message : "";
    const code =
      typeof parsed.error?.code === "string" ? parsed.error.code : "";
    detail = [code, message].filter(Boolean).join(": ");
  } catch {
    detail = body;
  }

  detail = detail
    .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi, "[image omitted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(?:gsk|sk)-[A-Za-z0-9_-]{8,}\b/g, "[credential omitted]")
    .replace(/\borg_[A-Za-z0-9_-]+\b/g, "[organization omitted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);

  const statusError =
    response.status === 429 ? "AI_RATE_LIMIT" : `AI_HTTP_${response.status}`;
  return new Error(detail ? `${statusError}:${detail}` : statusError);
}

async function chat(messages: ChatMessage[]): Promise<string> {
  const env = getEnv();

  if (!env.AI_API_KEY) {
    throw new Error("AI_UNCONFIGURED");
  }

  const timeout = Number(env.AI_TIMEOUT_MS ?? 45000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const provider = (env.AI_PROVIDER ?? "openai").toLowerCase();

    if (provider === "anthropic") {
      const systemMessage = messages.find(
        (message) => message.role === "system"
      );

      const anthropicMessages = messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));

      const response = await fetch(endpoint(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.AI_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelName(),
          max_tokens: 2000,
          system: systemMessage?.content ?? "",
          messages: anthropicMessages,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw await providerError(response);
      }

      const data = (await response.json()) as {
        content?: { type?: string; text?: string }[];
      };

      return (
        data.content
          ?.filter((item) => item.type === "text" || item.type == null)
          .map((item) => item.text ?? "")
          .join("\n") ?? ""
      );
    }

    const requestHeaders = {
      "content-type": "application/json",
      authorization: `Bearer ${env.AI_API_KEY}`,
    };

    const requestBody = {
      model: modelName(),
      temperature: 0,
      response_format: { type: "json_object" },
      messages,
    };

    let response = await fetch(endpoint(), {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    // Retry without response_format if the API rejects JSON mode.
    if (response.status === 400) {
      const errorText = await response.clone().text().catch(() => "");

      if (
        errorText.toLowerCase().includes("response_format") ||
        errorText.toLowerCase().includes("json_object")
      ) {
        response = await fetch(endpoint(), {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify({
            model: modelName(),
            temperature: 0,
            messages,
          }),
          signal: controller.signal,
        });
      }
    }

    if (response.status === 429) {
      // If Groq or OpenAI hits rate limit on the primary model, try fallback models!
      const currentModel = modelName();
      const candidateFallbacks = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"].filter((m) => m !== currentModel);
      for (const fallbackModel of candidateFallbacks) {
        try {
          const fallbackRes = await fetch(endpoint(), {
            method: "POST",
            headers: requestHeaders,
            body: JSON.stringify({
              ...requestBody,
              model: fallbackModel,
            }),
            signal: controller.signal,
          });
          if (fallbackRes.ok) {
            const fbData = (await fallbackRes.json()) as {
              choices?: { message?: { content?: string | null } }[];
            };
            const fbContent = fbData.choices?.[0]?.message?.content;
            if (fbContent) return fbContent;
          }
        } catch {
          // Continue to next fallback model
        }
      }
      throw await providerError(response);
    }

    if (!response.ok) {
      throw await providerError(response);
    }

    const data = (await response.json()) as {
      choices?: {
        message?: {
          content?: string | null;
        };
      }[];
    };

    return data.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(raw: string): unknown {
  let cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  if (start < 0) {
    throw new Error("AI_MALFORMED");
  }
  cleaned = cleaned.slice(start);

  // 1. Attempt direct JSON parsing if closing brace exists
  const end = cleaned.lastIndexOf("}");
  if (end >= 0) {
    try {
      return JSON.parse(cleaned.slice(0, end + 1)) as unknown;
    } catch {
      // JSON may be truncated or cut off inside an unclosed structure
    }
  }

  // 2. Repair truncated JSON by closing open arrays, objects, and strings
  const lastItemEnd = cleaned.lastIndexOf("}");
  if (lastItemEnd > 0) {
    let candidate = cleaned.slice(0, lastItemEnd + 1);
    let openBrackets = 0;
    let openBraces = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < candidate.length; i++) {
      const c = candidate[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (c === "{") openBraces++;
        else if (c === "}") openBraces--;
        else if (c === "[") openBrackets++;
        else if (c === "]") openBrackets--;
      }
    }

    while (openBrackets > 0) {
      candidate += "]";
      openBrackets--;
    }
    while (openBraces > 0) {
      candidate += "}";
      openBraces--;
    }

    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Continue to throw error below
    }
  }

  throw new Error("AI_MALFORMED");
}

export async function extractFromText(input: {
  text: string;
  language: string;
}): Promise<ExtractionPayload> {
  if (!isAiConfigured()) {
    throw new Error("AI_UNCONFIGURED");
  }

  const raw = await chat([
    {
      role: "system",
      content: SYSTEM_SAFETY,
    },
    {
      role: "user",
      content: `Extract structured medical information from this document text.

Return a JSON object matching the following fields:
documentType, sourceLanguage, labName, reportDate, patientNamePrinted, doctorName,
dischargeSummary, translatedSummary,
observations[{name,value,unit,referenceRange,page,confidence,uncertain,presentInSource}],
medications[{name,strength,instructions,route,frequency,handwriting,uncertain}],
handwritingDetected, unreadableRegions, notes, overallConfidence.

Rules:
- Copy values only if they are present in the source text.
- If a reference range is not printed, omit it.
- If handwriting is unclear, set handwritingDetected to true and uncertain to true where appropriate.
- Never guess a medicine name, strength, or dose.
- For a discharge summary or medical report (lab report, diagnostic report, doctor consultation), write a comprehensive source-grounded clinical summary in dischargeSummary covering the tests performed, key results, which values are normal, which are out-of-range/elevated, and any physician impressions or follow-up instructions legible in the source.
- Translate this clinical summary into the requested language in translatedSummary. Preserve medicine names, doses, units, and dates.
- Mark uncertain information clearly.
- Do not diagnose or recommend treatment.
- Return valid JSON only.

User interface language (for notes only): ${input.language}

Document text:
${input.text.slice(0, 20000)}`,
    },
  ]);

  const parsed = extractionSchema.safeParse(extractJson(raw));

  if (!parsed.success) {
    throw new Error("AI_INVALID_SCHEMA");
  }

  return parsed.data;
}

export async function extractMedicalDocumentFromImages(input: {
  images: PrescriptionImage[];
  language: string;
  documentType?: "prescription" | "discharge_summary" | "lab_report" | "diagnostic_report";
}): Promise<ExtractionPayload> {
  if (!isAiConfigured()) {
    throw new Error("AI_UNCONFIGURED");
  }
  if (input.images.length === 0 || input.images.length > 6) {
    throw new Error("AI_INVALID_IMAGE_COUNT");
  }

  const env = getEnv();
  if (!env.AI_API_KEY) {
    throw new Error("AI_UNCONFIGURED");
  }
  const provider = (env.AI_PROVIDER ?? "openai").toLowerCase();
  const documentType = input.documentType ?? "prescription";
  const isDischargeSummary = documentType === "discharge_summary";
  const isLabReport = documentType === "lab_report" || documentType === "diagnostic_report";
  const system = isDischargeSummary
    ? `${SYSTEM_SAFETY}
You are carefully reading a hospital discharge document. Summarize only information legible in the source. Never infer missing diagnoses, treatments, medicines, or instructions.`
    : isLabReport
      ? `${SYSTEM_SAFETY}
You are carefully reading a medical laboratory or diagnostic test report image. Extract all test names, values, units, reference ranges, and doctor notes. Provide a comprehensive source-grounded clinical summary.`
      : `${SYSTEM_SAFETY}
You are carefully transcribing a prescription image. Never infer a medicine, strength, dose, or schedule from context.`;
  const languageName =
    input.language === "hi"
      ? "Hindi"
      : input.language === "te"
        ? "Telugu"
        : "English";
  const prompt = isDischargeSummary
    ? `Read this hospital discharge document and return one compact JSON object with:
documentType, sourceLanguage, reportDate, patientNamePrinted, doctorName,
dischargeSummary, translatedSummary,
observations[{name,value,unit,referenceRange,page,confidence,uncertain,presentInSource}],
medications[{name,strength,instructions,route,frequency,handwriting,uncertain}],
handwritingDetected, unreadableRegions, notes, overallConfidence.

Set documentType to "discharge_summary". Write a concise, clear summary in ${languageName} covering admission and discharge dates, stated diagnosis, treatment/procedures, condition at discharge, prescribed discharge medicines, and follow-up instructions only if each is legible in the document. Put the summary in dischargeSummary and a faithful translation in translatedSummary. Omit unavailable details; do not guess or add medical advice. Preserve medicine names, doses, units, and dates. Include observations and medicines only when explicitly listed. Mark unclear text as uncertain and describe unreadable regions. Return valid JSON only.`
    : isLabReport
      ? `Read this medical laboratory / diagnostic test report image and return JSON:
documentType ("lab_report"), labName, reportDate, patientNamePrinted, doctorName,
dischargeSummary, observations: [{name, value, unit, referenceRange}].
Do not output specimen or test_method.
In dischargeSummary, write a 2-sentence clinical summary highlighting normal results and out-of-range values. Return compact valid JSON only.`
    : `Read only this prescription; ignore unrelated text or documents. Return one compact JSON object with:
documentType, sourceLanguage, reportDate, patientNamePrinted, doctorName,
prescriptionSummary, translatedSummary,
medications[{name,strength,instructions,route,frequency,handwriting,uncertain,confidence}],
handwritingDetected, unreadableRegions, notes, overallConfidence.

Set documentType to "prescription". Keep each summary to 1–2 concise sentences and translate it faithfully into ${languageName}. Keep medicine names, doses, units, and numerals unchanged in the translation.
  Include patient, prescriber, and date only when legible. List only medicines visible in this prescription, each separately, preserving written strength, route, frequency, duration, and instructions. The name field is required: omit a medicine with an illegible name and describe it in unreadableRegions. Never guess unclear content. Mark uncertain readings accurately. Do not recommend or change treatment. Use concise values and return valid JSON only, including empty arrays when needed.`;

  let raw: string;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number(env.AI_TIMEOUT_MS ?? 45000),
  );

  const isPrescription = documentType === "prescription";
  const maxTokens = isPrescription ? 900 : 980;

  try {
    if (provider === "anthropic") {
      const response = await fetch(endpoint(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.AI_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelName(),
          max_tokens: 4000,
          system,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                ...input.images.map((image) => ({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: image.mimeType,
                    data: image.base64,
                  },
                })),
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw await providerError(response);
      }
      const data = (await response.json()) as {
        content?: { type?: string; text?: string }[];
      };
      raw =
        data.content
          ?.filter((item) => item.type === "text" || item.type == null)
          .map((item) => item.text ?? "")
          .join("\n") ?? "";
    } else {
      const requestHeaders = {
        "content-type": "application/json",
        authorization: `Bearer ${env.AI_API_KEY}`,
      };
      const content = [
        { type: "text", text: prompt },
        ...input.images.map((image) => ({
          type: "image_url",
          image_url: {
            url: `data:${image.mimeType};base64,${image.base64}`,
          },
        })),
      ];
      let response = await fetch(endpoint(), {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({
          model: modelName(),
          temperature: 0,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content },
          ],
        }),
        signal: controller.signal,
      });

      if (response.status === 400) {
        const errorText = await response.clone().text().catch(() => "");
        if (
          errorText.toLowerCase().includes("response_format") ||
          errorText.toLowerCase().includes("json_object")
        ) {
          response = await fetch(endpoint(), {
            method: "POST",
            headers: requestHeaders,
            body: JSON.stringify({
              model: modelName(),
              temperature: 0,
              max_tokens: maxTokens,
              messages: [
                { role: "system", content: system },
                { role: "user", content },
              ],
            }),
            signal: controller.signal,
          });
        }
      }

      if (!response.ok) {
        throw await providerError(response);
      }
      const data = (await response.json()) as {
        choices?: {
          finish_reason?: string | null;
          message?: { content?: string | null };
        }[];
      };
      const isTruncated = data.choices?.[0]?.finish_reason === "length";
      raw = data.choices?.[0]?.message?.content ?? "";
      if (isTruncated && !raw.trim()) {
        throw new Error("AI_RESPONSE_TRUNCATED");
      }
    }
  } finally {
    clearTimeout(timer);
  }

  let responseData: unknown;
  try {
    responseData = extractJson(raw);
  } catch (err) {
    if (raw.includes("prescription") || raw.includes("documentType")) {
      throw new Error("AI_RESPONSE_TRUNCATED");
    }
    throw err;
  }
  if (
    responseData === null ||
    typeof responseData !== "object" ||
    Array.isArray(responseData)
  ) {
    throw new Error("AI_INVALID_SCHEMA");
  }

  const candidate = { ...(responseData as Record<string, unknown>) };

  // Normalize common patient, doctor, lab, and date aliases from laboratory formats
  const patientInfo = (candidate.patient_information || candidate.patient || {}) as Record<string, unknown>;
  if (!candidate.patientNamePrinted && patientInfo.name) {
    candidate.patientNamePrinted = String(patientInfo.name);
  }
  if (!candidate.doctorName && (patientInfo.referred_by || candidate.referred_by || candidate.prescriberName)) {
    candidate.doctorName = String(patientInfo.referred_by || candidate.referred_by || candidate.prescriberName);
  }
  if (!candidate.labName && (candidate.reporting_org || candidate.laboratory || candidate.hospitalName)) {
    candidate.labName = String(candidate.reporting_org || candidate.laboratory || candidate.hospitalName);
  }
  const timestamps = (candidate.timestamps || {}) as Record<string, unknown>;
  if (!candidate.reportDate && (timestamps.reported_on || candidate.reported_on || candidate.date)) {
    candidate.reportDate = String(timestamps.reported_on || candidate.reported_on || candidate.date);
  }

  // Normalize summary fields
  if (!candidate.dischargeSummary) {
    candidate.dischargeSummary = (
      candidate.summary ||
      candidate.clinical_summary ||
      candidate.report_summary ||
      candidate.findings ||
      candidate.interpretation ||
      candidate.prescriptionSummary ||
      undefined
    ) as string | undefined;
  }

  // Normalize observations from test_results, tests, lab_results, parameters, or findings
  const rawObsList = (
    Array.isArray(candidate.observations) ? candidate.observations :
    Array.isArray(candidate.test_results) ? candidate.test_results :
    Array.isArray(candidate.tests) ? candidate.tests :
    Array.isArray(candidate.lab_results) ? candidate.lab_results :
    Array.isArray(candidate.results) ? candidate.results :
    Array.isArray(candidate.parameters) ? candidate.parameters :
    []
  );

  const normalizedObservations = rawObsList
    .map((obs) => {
      if (!obs || typeof obs !== "object") return null;
      const o = obs as Record<string, unknown>;
      const name = String(o.name || o.test_name || o.testName || o.parameter || o.test || "").trim();
      const value = String(o.value || o.result || o.test_result || o.val || "").trim();
      if (!name || !value) return null;

      const unit = String(o.unit || o.units || o.measurement_unit || "").trim();
      const referenceRange = String(
        o.referenceRange ||
        o.reference_range ||
        o.reference_interval ||
        o.biological_reference_interval ||
        o.ref_range ||
        o.range ||
        ""
      ).trim();

      return {
        name,
        value,
        unit,
        referenceRange: referenceRange || undefined,
        uncertain: Boolean(o.uncertain),
        presentInSource: o.presentInSource !== false,
      };
    })
    .filter(Boolean);

  candidate.observations = normalizedObservations;
  const notes = Array.isArray(candidate.notes)
    ? candidate.notes.filter((note): note is string => typeof note === "string")
    : [];
  const textFieldLimits: Record<string, number> = {
    sourceLanguage: 40,
    labName: 200,
    reportDate: 40,
    patientNamePrinted: 200,
    doctorName: 200,
    prescriptionSummary: 8000,
    dischargeSummary: 8000,
    translatedSummary: 8000,
  };
  let omittedOverlongText = false;
  for (const [field, maxLength] of Object.entries(textFieldLimits)) {
    const value = candidate[field];
    if (typeof value === "string" && value.length > maxLength) {
      delete candidate[field];
      omittedOverlongText = true;
    } else if (value === null || (value !== undefined && typeof value !== "string")) {
      delete candidate[field];
    }
  }
  if (omittedOverlongText) {
    notes.push("Some text was too long to verify and was omitted.");
  }
  const rawMedications = Array.isArray(candidate.medications)
    ? candidate.medications
    : [];
  const omittedUnreadableMedicine = rawMedications.some(
    (medication) =>
      medication === null ||
      typeof medication !== "object" ||
      !("name" in medication) ||
      typeof medication.name !== "string" ||
      !medication.name.trim(),
  );
  const medications = rawMedications.filter(
    (medication): medication is Record<string, unknown> =>
      medication !== null &&
      typeof medication === "object" &&
      "name" in medication &&
      typeof medication.name === "string" &&
      medication.name.trim().length > 0 &&
      medication.name.length <= 200,
  ).map((medication) => {
    const normalized = { ...medication };

    const medicationFieldLimits = {
      strength: 80,
      instructions: 500,
      route: 80,
      frequency: 120,
    } as const;
    for (const [field, maxLength] of Object.entries(medicationFieldLimits)) {
      const key = field as keyof typeof medicationFieldLimits;
      if (normalized[field] === null) {
        if (key === "strength" || key === "instructions") {
          normalized[field] = "";
        } else {
          delete normalized[field];
        }
      } else if (
        normalized[field] !== undefined &&
        typeof normalized[field] !== "string"
      ) {
        delete normalized[field];
        normalized.uncertain = true;
      } else if (
        typeof normalized[field] === "string" &&
        normalized[field].length > maxLength
      ) {
        delete normalized[field];
        normalized.uncertain = true;
        omittedOverlongText = true;
      }
    }
    if (
      normalized.confidence !== undefined &&
      (typeof normalized.confidence !== "number" ||
        !Number.isFinite(normalized.confidence) ||
        normalized.confidence < 0 ||
        normalized.confidence > 1)
    ) {
      delete normalized.confidence;
      normalized.uncertain = true;
    }
    for (const field of ["handwriting", "uncertain"] as const) {
      if (
        normalized[field] !== undefined &&
        typeof normalized[field] !== "boolean"
      ) {
        delete normalized[field];
        normalized.uncertain = true;
      }
    }

    return normalized;
  });
  const unreadableRegions = Array.isArray(candidate.unreadableRegions)
    ? candidate.unreadableRegions.filter(
        (region): region is string => typeof region === "string",
      )
    : [];
  if (
    omittedUnreadableMedicine &&
    !unreadableRegions.some(
      (region) =>
        typeof region === "string" &&
        region.toLowerCase().includes("medicine"),
    )
  ) {
    unreadableRegions.push("A medicine name was not clear enough to transcribe.");
  }
  if (
    omittedOverlongText &&
    !notes.includes("Some text was too long to verify and was omitted.")
  ) {
    notes.push("Some text was too long to verify and was omitted.");
  }
  if (
    candidate.overallConfidence !== undefined &&
    (typeof candidate.overallConfidence !== "number" ||
      !Number.isFinite(candidate.overallConfidence) ||
      candidate.overallConfidence < 0 ||
      candidate.overallConfidence > 1)
  ) {
    delete candidate.overallConfidence;
    notes.push("The model did not provide a valid confidence score.");
  }
  candidate.notes = notes.slice(0, 20);
  candidate.unreadableRegions = unreadableRegions.slice(0, 20);

  const parsed = extractionSchema.safeParse({
    ...candidate,
    documentType,
    medications,
    unreadableRegions,
  });
  if (!parsed.success) {
    const issueCodes = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "response"}:${issue.code}`)
      .join(",");
    throw new Error(`AI_INVALID_SCHEMA:${issueCodes}`);
  }
  return parsed.data;
}

export function extractPrescriptionFromImages(input: {
  images: PrescriptionImage[];
  language: string;
}) {
  return extractMedicalDocumentFromImages({ ...input, documentType: "prescription" });
}

export async function assistantReply(input: {
  language: string;
  question: string;
  history: {
    role: "user" | "assistant";
    content: string;
  }[];
  records: string;
}) {
  if (!isAiConfigured()) {
    throw new Error("AI_UNCONFIGURED");
  }

  const raw = await chat([
    {
      role: "system",
      content: SYSTEM_SAFETY,
    },
    ...input.history.slice(-8),
    {
      role: "user",
      content: `Respond in this language: ${input.language}.

Answer the question directly. For general questions, use general knowledge.
For questions about the user's own health, use only the confirmed records below and clearly state when those records do not contain enough information.
Do not invent personal medical facts.

User-confirmed records:
${input.records || "None"}

Question:
${input.question}

Return a valid JSON object with these keys:
{
  "reply": "Your helpful and accurate answer",
  "usedRecordIds": [],
  "caution": true
}

Rules:
- Do not diagnose or prescribe medicines.
- Answer general questions with useful, relevant explanations rather than repeating the records.
- Do not invent missing user-specific medical information.
- Explain uncertainty when relevant.
- Encourage consultation with a qualified healthcare professional when appropriate.
- Keep medicine names, doses, units, and numerals unchanged.
- Set caution to true when medical uncertainty or safety concerns are present.
- Return valid JSON only.`,
    },
  ]);

  try {
    const json = extractJson(raw);
    const parsed = assistantOutputSchema.safeParse(json);

    if (parsed.success) {
      return parsed.data;
    }

    // Recover a valid reply when the model returns the expected
    // reply field but other fields do not match the schema.
    if (
      json !== null &&
      typeof json === "object" &&
      "reply" in json &&
      typeof (json as { reply: unknown }).reply === "string"
    ) {
      const result = json as {
        reply: string;
        usedRecordIds?: unknown;
        caution?: unknown;
      };

      return {
        reply: result.reply,
        usedRecordIds: Array.isArray(result.usedRecordIds)
          ? result.usedRecordIds.filter(
              (id): id is string => typeof id === "string"
            )
          : [],
        caution:
          typeof result.caution === "boolean" ? result.caution : true,
      };
    }
  } catch {
    // If JSON parsing fails, use the non-empty response as plain text.
    // This fallback does not bypass the system's medical safety rules.
    const cleaned = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    if (cleaned.length > 0) {
      return {
        reply: cleaned,
        usedRecordIds: [],
        caution: true,
      };
    }
  }

  throw new Error("AI_INVALID_SCHEMA");
}

export { SYSTEM_SAFETY };