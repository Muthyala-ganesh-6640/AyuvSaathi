import { NextRequest } from "next/server";
import { store, saveUpload } from "@/lib/db/file-store";
import { jsonError, limitOrThrow, withUser } from "@/lib/api";
import { detectKind, MAX_UPLOAD_BYTES, mimeFor } from "@/lib/files/validate";
import { nowIso, safeFileName } from "@/lib/utils";
import { isAiConfigured } from "@/lib/env";
import { extractPdfText, renderPdfPages } from "@/lib/documents/parse";
import {
  extractFromText,
  extractMedicalDocumentFromImages,
  extractPrescriptionFromImages,
} from "@/lib/ai/provider";
import type { ExtractionPayload } from "@/lib/ai/schemas";
import type { DocumentCategory } from "@/lib/db/types";
import { routing } from "@/i18n/routing";
import { buildReportAnalysis } from "@/lib/medical/report-summary";
import { canAccessPatientData } from "@/lib/auth/authorization";

export async function GET(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const requestedProfileId = request.nextUrl.searchParams.get("patientProfileId") || auth.user.id;
  const authCheck = await canAccessPatientData(auth.user, requestedProfileId, "viewRecords");
  if (!authCheck.authorized) {
    return jsonError("Unauthorized to view documents for this profile", 403);
  }
  const documents = await store.listDocuments(requestedProfileId);
  const extractions = await Promise.all(
    documents
      .filter((document) => document.category === "prescription")
      .map(async (document) => ({
        documentId: document.id,
        extraction: (await store.listExtractions(document.id, auth.user.id))
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0],
      })),
  );
  const extractionByDocument = new Map(
    extractions.map(({ documentId, extraction }) => [documentId, extraction]),
  );

  return Response.json({
    documents: documents.map((document) => ({
      ...document,
      prescriptionExtraction: extractionByDocument.get(document.id)?.structured ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const limited = limitOrThrow(`upload:${auth.user.id}`, 20, 60 * 60_000);
  if (limited) return limited;
  const form = await request.formData();
  const file = form.get("file");
  const category = String(form.get("category") ?? "lab_report") as DocumentCategory;
  const language = routing.locales.includes(
    String(form.get("language") ?? auth.user.interfaceLanguage) as (typeof routing.locales)[number],
  )
    ? (String(form.get("language") ?? auth.user.interfaceLanguage) as (typeof routing.locales)[number])
    : auth.user.interfaceLanguage;
  if (!(file instanceof File)) return jsonError("Choose a PDF, JPEG, or PNG file.", 400);
  if (file.size > MAX_UPLOAD_BYTES) return jsonError("Files must be 10 MB or smaller.", 400);
  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = detectKind(buffer, file.type, file.name);
  if (!kind) return jsonError("Only PDF, JPEG, and PNG files are accepted.", 400);

  const allowedCategory: DocumentCategory[] = [
    "lab_report",
    "prescription",
    "imaging",
    "discharge_summary",
    "doctor_visit",
    "diagnostic_report",
    "other",
  ];
  const cat = allowedCategory.includes(category) ? category : "other";
  const rawOwnerId = form.get("ownerId");
  let targetOwnerId = auth.user.id;
  if (rawOwnerId && typeof rawOwnerId === "string" && rawOwnerId !== auth.user.id) {
    const authCheck = await canAccessPatientData(auth.user, rawOwnerId, "uploadReports");
    if (!authCheck.authorized) {
      return jsonError(authCheck.reason || "Unauthorized to upload reports for this patient", 403);
    }
    targetOwnerId = rawOwnerId;
  }

  const id = crypto.randomUUID();
  const ext = kind === "pdf" ? ".pdf" : kind === "png" ? ".png" : ".jpg";
  const storagePath = await saveUpload(targetOwnerId, id, buffer, ext);
  const created = nowIso();
  let processingStatus: "pending" | "extracted" | "needs_review" | "manual" | "unconfigured" | "failed" =
    "pending";
  const notes: string[] = [];
  let extractionId: string | undefined;
  let detectedReportDate: string | undefined;
  let prescriptionExtraction: Awaited<ReturnType<typeof extractPrescriptionFromImages>> | undefined;

  if (cat === "discharge_summary") {
    if (!isAiConfigured()) {
      processingStatus = "unconfigured";
      notes.push("AI is not configured. The document was saved but could not be summarized.");
    } else {
      try {
        let extracted: ExtractionPayload;
        if (kind === "pdf") {
          const text = await extractPdfText(buffer);
          if (text) {
            extracted = await extractFromText({ text, language: auth.user.aiLanguage });
          } else {
            const rendered = await renderPdfPages(buffer);
            if (rendered.totalPages > rendered.images.length) {
              notes.push(
                `Only the first ${rendered.images.length} of ${rendered.totalPages} pages were analyzed.`,
              );
            }
            extracted = await extractMedicalDocumentFromImages({
              images: rendered.images,
              language: auth.user.aiLanguage,
              documentType: "discharge_summary",
            });
          }
        } else {
          extracted = await extractMedicalDocumentFromImages({
            images: [
              {
                mimeType: kind === "png" ? "image/png" : "image/jpeg",
                base64: buffer.toString("base64"),
              },
            ],
            language: auth.user.aiLanguage,
            documentType: "discharge_summary",
          });
        }

        extractionId = crypto.randomUUID();
        detectedReportDate = extracted.reportDate;
        notes.push(...extracted.notes);
        for (const observation of extracted.observations.filter(
          (item) => item.presentInSource !== false,
        )) {
          await store.saveObservation({
            id: crypto.randomUUID(),
            ownerId: auth.user.id,
            documentId: id,
            extractionId,
            name: observation.name,
            value: observation.value,
            unit: observation.unit ?? "",
            referenceRange: observation.referenceRange,
            uncertain: observation.uncertain ?? true,
            verificationStatus: "unconfirmed",
            provenance: "ai_extracted",
            createdAt: created,
            updatedAt: created,
          });
        }
        if (!extracted.dischargeSummary?.trim()) {
          const summaryNote = "No clear discharge summary could be identified in this document.";
          extracted.notes.push(summaryNote);
          notes.push(summaryNote);
          processingStatus = "needs_review";
        } else {
          processingStatus =
            extracted.handwritingDetected || (extracted.overallConfidence ?? 0) < 0.7
              ? "needs_review"
              : "extracted";
        }
        await store.saveExtraction({
          id: extractionId,
          documentId: id,
          ownerId: auth.user.id,
          structured: extracted,
          confidence: extracted.overallConfidence,
          validationStatus: extracted.dischargeSummary?.trim() ? "valid" : "partial",
          confirmationStatus: "unconfirmed",
          model: process.env.AI_MODEL,
          notes: [...notes, ...extracted.unreadableRegions],
          createdAt: created,
          updatedAt: created,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "EXTRACT_FAILED";
        processingStatus = message === "AI_UNCONFIGURED" ? "unconfigured" : "failed";
        console.error("[Discharge Summary Analysis] Extraction failed:", error);
        if (message.startsWith("AI_HTTP_")) {
          const status = message.match(/^AI_HTTP_(\d+)/)?.[1] ?? "unknown";
          notes.push(`The AI provider rejected the summary request (HTTP ${status}).`);
        } else if (message.startsWith("AI_RATE_LIMIT")) {
          notes.push("The AI provider is temporarily at its usage limit. Try summarizing this document again later.");
        } else if (message.startsWith("AI_RESPONSE_TRUNCATED")) {
          notes.push("The document is too long to summarize in one response. Try uploading fewer pages at a time.");
        } else if (message.startsWith("AI_INVALID_SCHEMA") || message.startsWith("AI_MALFORMED")) {
          notes.push("The document could not be summarized clearly. Try a sharper image or a text-based PDF.");
        } else {
          notes.push("The document was saved, but automatic summarization failed.");
        }
      }
    }
  } else if (cat === "prescription") {
    if (!isAiConfigured()) {
      processingStatus = "unconfigured";
      notes.push("AI is not configured. The prescription was saved but could not be analyzed.");
    } else {
      try {
        let images: { mimeType: "image/jpeg" | "image/png"; base64: string }[];
        if (kind === "pdf") {
          const rendered = await renderPdfPages(buffer);
          images = rendered.images;
          if (rendered.totalPages > rendered.images.length) {
            notes.push(
              `Only the first ${rendered.images.length} of ${rendered.totalPages} pages were analyzed.`,
            );
          }
        } else {
          images = [
            {
              mimeType: kind === "png" ? "image/png" : "image/jpeg",
              base64: buffer.toString("base64"),
            },
          ];
        }

        prescriptionExtraction = await extractPrescriptionFromImages({
          images,
          language,
        });
        extractionId = crypto.randomUUID();
        detectedReportDate = prescriptionExtraction.reportDate;
        notes.push(...prescriptionExtraction.notes);
        await store.saveExtraction({
          id: extractionId,
          documentId: id,
          ownerId: auth.user.id,
          structured: prescriptionExtraction,
          confidence: prescriptionExtraction.overallConfidence,
          validationStatus: "valid",
          confirmationStatus: "unconfirmed",
          model: process.env.AI_MODEL,
          notes: [...notes, ...prescriptionExtraction.unreadableRegions],
          createdAt: created,
          updatedAt: created,
        });

        const hasUncertainMedication = prescriptionExtraction.medications.some(
          (medication) => medication.uncertain || medication.handwriting,
        );
        processingStatus =
          prescriptionExtraction.handwritingDetected ||
          hasUncertainMedication ||
          (prescriptionExtraction.overallConfidence ?? 0) < 0.9
            ? "needs_review"
            : "extracted";
      } catch (error) {
        const message = error instanceof Error ? error.message : "EXTRACT_FAILED";
        processingStatus = message === "AI_UNCONFIGURED" ? "unconfigured" : "failed";
        console.error("[Prescription Analysis] Extraction failed:", error);
        if (message.startsWith("AI_INVALID_SCHEMA")) {
          notes.push(
            "The AI could not structure this prescription clearly enough. Try a sharper, well-lit image or a PDF, and verify the original with a pharmacist or clinician.",
          );
        } else if (message.startsWith("AI_RESPONSE_TRUNCATED")) {
          notes.push(
            "The prescription is too detailed to analyze in one response. Upload a clearer image of one page at a time, then verify the original with a pharmacist or clinician.",
          );
        } else if (message.startsWith("AI_RATE_LIMIT")) {
          notes.push(
            "The AI provider is temporarily at its usage limit. The prescription was saved; try analyzing it again later.",
          );
        } else if (message.startsWith("AI_HTTP_")) {
          const status = message.match(/^AI_HTTP_(\d+)/)?.[1] ?? "unknown";
          notes.push(
            `The AI provider rejected the analysis request (HTTP ${status}). The prescription was saved; try a clearer or smaller file, or check the provider configuration.`,
          );
        } else {
          notes.push(
            "The file was saved, but automatic analysis failed. Review the original prescription with a pharmacist or clinician.",
          );
        }
      }
    }
  } else if (kind === "pdf") {
    try {
      const text = await extractPdfText(buffer);
      if (!text) {
        if (isAiConfigured()) {
          const rendered = await renderPdfPages(buffer);
          const extracted = await extractMedicalDocumentFromImages({
            images: rendered.images,
            language: auth.user.aiLanguage,
            documentType: cat === "diagnostic_report" ? "diagnostic_report" : "lab_report",
          });
          extractionId = crypto.randomUUID();
          if (extracted.reportDate) {
            detectedReportDate = extracted.reportDate;
          }
          await store.saveExtraction({
            id: extractionId,
            documentId: id,
            ownerId: auth.user.id,
            structured: extracted,
            confidence: extracted.overallConfidence,
            validationStatus: "valid",
            confirmationStatus: "unconfirmed",
            model: process.env.AI_MODEL,
            notes: extracted.notes,
            createdAt: created,
            updatedAt: created,
          });
          for (const obs of extracted.observations.filter((o) => o.presentInSource !== false)) {
            await store.saveObservation({
              id: crypto.randomUUID(),
              ownerId: auth.user.id,
              documentId: id,
              extractionId,
              name: obs.name,
              value: obs.value,
              unit: obs.unit ?? "",
              referenceRange: obs.referenceRange,
              uncertain: obs.uncertain ?? true,
              verificationStatus: "unconfirmed",
              provenance: "ai_extracted",
              createdAt: created,
              updatedAt: created,
            });
          }
          processingStatus =
            extracted.handwritingDetected || (extracted.overallConfidence ?? 0) < 0.7
              ? "needs_review"
              : "extracted";
        } else {
          processingStatus = "unconfigured";
          notes.push("No selectable text was found. Image-only PDFs need AI vision or manual entry.");
        }
      } else if (isAiConfigured()) {
        const extracted = await extractFromText({
          text,
          language: auth.user.aiLanguage,
        });
        extractionId = crypto.randomUUID();
        if (extracted.reportDate) {
          detectedReportDate = extracted.reportDate;
        }
        await store.saveExtraction({
          id: extractionId,
          documentId: id,
          ownerId: auth.user.id,
          structured: extracted,
          confidence: extracted.overallConfidence,
          validationStatus: "valid",
          confirmationStatus: "unconfirmed",
          model: process.env.AI_MODEL,
          notes: extracted.notes,
          createdAt: created,
          updatedAt: created,
        });
        for (const obs of extracted.observations.filter((o) => o.presentInSource !== false)) {
          await store.saveObservation({
            id: crypto.randomUUID(),
            ownerId: auth.user.id,
            documentId: id,
            extractionId,
            name: obs.name,
            value: obs.value,
            unit: obs.unit ?? "",
            referenceRange: obs.referenceRange,
            uncertain: obs.uncertain ?? true,
            verificationStatus: "unconfirmed",
            provenance: "ai_extracted",
            createdAt: created,
            updatedAt: created,
          });
        }
        processingStatus =
          extracted.handwritingDetected || (extracted.overallConfidence ?? 0) < 0.7
            ? "needs_review"
            : "extracted";
      } else {
        processingStatus = "unconfigured";
        notes.push("AI is not configured. You can enter values from the original document yourself.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "EXTRACT_FAILED";
      if (message === "AI_UNCONFIGURED") processingStatus = "unconfigured";
      else processingStatus = "failed";
      notes.push("Automatic extraction could not be completed. The original file was still saved.");
    }
  } else if (kind === "jpeg" || kind === "png") {
    if (isAiConfigured()) {
      try {
        const extracted = await extractMedicalDocumentFromImages({
          images: [
            {
              mimeType: kind === "png" ? "image/png" : "image/jpeg",
              base64: buffer.toString("base64"),
            },
          ],
          language: auth.user.aiLanguage,
          documentType: cat === "diagnostic_report" ? "diagnostic_report" : "lab_report",
        });
        extractionId = crypto.randomUUID();
        if (extracted.reportDate) {
          detectedReportDate = extracted.reportDate;
        }
        await store.saveExtraction({
          id: extractionId,
          documentId: id,
          ownerId: auth.user.id,
          structured: extracted,
          confidence: extracted.overallConfidence,
          validationStatus: "valid",
          confirmationStatus: "unconfirmed",
          model: process.env.AI_MODEL,
          notes: extracted.notes,
          createdAt: created,
          updatedAt: created,
        });
        for (const obs of extracted.observations.filter((o) => o.presentInSource !== false)) {
          await store.saveObservation({
            id: crypto.randomUUID(),
            ownerId: auth.user.id,
            documentId: id,
            extractionId,
            name: obs.name,
            value: obs.value,
            unit: obs.unit ?? "",
            referenceRange: obs.referenceRange,
            uncertain: obs.uncertain ?? true,
            verificationStatus: "unconfirmed",
            provenance: "ai_extracted",
            createdAt: created,
            updatedAt: created,
          });
        }
        processingStatus =
          extracted.handwritingDetected || (extracted.overallConfidence ?? 0) < 0.7
            ? "needs_review"
            : "extracted";
      } catch (err) {
        console.error("[Document Image Vision Extraction] Failed:", err);
        processingStatus = "needs_review";
        notes.push("Image was saved. Automatic vision extraction encountered an error; values can be confirmed manually.");
      }
    } else {
      processingStatus = "unconfigured";
      notes.push("Image document was saved. AI provider is not configured for automatic vision extraction.");
    }
  } else {
    processingStatus = "manual";
    notes.push("Manual review required.");
  }

  const doc = await store.saveDocument({
    id,
    ownerId: auth.user.id,
    category: cat,
    storagePath,
    displayName: safeFileName(file.name) || `document-${id}`,
    mimeType: mimeFor(kind),
    fileSize: buffer.length,
    uploadStatus: "uploaded",
    processingStatus,
    processingNote:
      processingStatus === "failed" || processingStatus === "unconfigured"
        ? notes.at(-1)
        : undefined,
    sourceDate: detectedReportDate,
    createdAt: created,
    updatedAt: created,
  });

  // Clinical timeline mapping with proper categorization and event date
  let timelineType: "document" | "prescription" | "discharge" | "consultation" = "document";
  let summaryPrefix = "Uploaded medical document";

  if (cat === "prescription") {
    timelineType = "prescription";
    summaryPrefix = "Prescription recorded";
  } else if (cat === "discharge_summary") {
    timelineType = "discharge";
    summaryPrefix = "Hospital discharge summary recorded";
  } else if (cat === "doctor_visit") {
    timelineType = "consultation";
    summaryPrefix = "Doctor consultation record added";
  } else if (cat === "lab_report" || cat === "diagnostic_report") {
    timelineType = "document";
    summaryPrefix = `Lab/Diagnostic report added`;
  }

  const detectedDateTimestamp = detectedReportDate ? Date.parse(detectedReportDate) : Number.NaN;
  const clinicalDate = Number.isFinite(detectedDateTimestamp)
    ? new Date(detectedDateTimestamp).toISOString()
    : created;

  await store.addTimeline({
    id: crypto.randomUUID(),
    ownerId: auth.user.id,
    type: timelineType,
    relatedId: id,
    eventDate: clinicalDate,
    summary: `${summaryPrefix}: ${doc.displayName}`,
    provenance: "source_document",
    createdAt: created,
  });

  const [savedObservations, savedExtractions] = await Promise.all([
    store.listObservations(auth.user.id, id),
    store.listExtractions(id, auth.user.id),
  ]);
  const latestExt = savedExtractions[0] || null;
  const analysis = buildReportAnalysis(doc, savedObservations, latestExt, auth.user.interfaceLanguage);

  return Response.json({
    document: doc,
    notes,
    observations: savedObservations,
    analysis,
    prescriptionExtraction: prescriptionExtraction ?? null,
  });
}