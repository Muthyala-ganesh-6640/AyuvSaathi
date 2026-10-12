import { z } from "zod";

export const observationDraftSchema = z.object({
  name: z.string().min(1).max(200),
  value: z.string().min(1).max(80),
  unit: z.string().max(40).optional().default(""),
  referenceRange: z.string().max(80).optional(),
  page: z.string().max(20).optional(),
  confidence: z.number().min(0).max(1).optional(),
  uncertain: z.boolean().optional().default(true),
  presentInSource: z.boolean().optional().default(true),
});

export const medicationDraftSchema = z.object({
  name: z.string().min(1).max(200),
  strength: z.string().max(80).optional().default(""),
  instructions: z.string().max(500).optional().default(""),
  route: z.string().max(80).optional(),
  frequency: z.string().max(120).optional(),
  handwriting: z.boolean().optional().default(false),
  uncertain: z.boolean().optional().default(true),
  confidence: z.number().min(0).max(1).optional(),
});

export const extractionSchema = z.object({
  documentType: z.enum(["lab_report", "prescription", "discharge_summary", "unknown"]),
  sourceLanguage: z.string().max(40).optional(),
  labName: z.string().max(200).optional(),
  reportDate: z.string().max(40).optional(),
  patientNamePrinted: z.string().max(200).optional(),
  doctorName: z.string().max(200).optional(),
  prescriptionSummary: z.string().max(8000).optional(),
  dischargeSummary: z.string().max(8000).optional(),
  translatedSummary: z.string().max(8000).optional(),
  observations: z.array(observationDraftSchema).max(80).default([]),
  medications: z.array(medicationDraftSchema).max(40).default([]),
  handwritingDetected: z.boolean().optional().default(false),
  unreadableRegions: z.array(z.string()).max(20).default([]),
  notes: z.array(z.string()).max(20).default([]),
  overallConfidence: z.number().min(0).max(1).optional(),
});

export type ExtractionPayload = z.infer<typeof extractionSchema>;

export const assistantOutputSchema = z.object({
  reply: z.string().min(1).max(8000),
  usedRecordIds: z.array(z.string()).max(30).default([]),
  caution: z
    .union([z.boolean(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (typeof v === "boolean") return v;
      if (typeof v === "string") return Boolean(v.trim());
      return true;
    }),
});