import type { MedicalDocument, Observation, Extraction } from "@/lib/db/types";
import { compareToSourceRange } from "@/lib/medical/ranges";

export interface ReportAnalysisResult {
  summary: string;
  translatedSummary?: string;
  overallStatus: "normal" | "abnormal_findings" | "needs_review" | "pending";
  totalTests: number;
  normalCount: number;
  abnormalCount: number;
  unspecifiedCount: number;
  abnormalItems: Array<{
    name: string;
    value: string;
    unit: string;
    referenceRange?: string;
    status: "elevated" | "low" | "out_of_range";
  }>;
  normalItems: Array<{
    name: string;
    value: string;
    unit: string;
    referenceRange?: string;
  }>;
  suggestedQuestions: string[];
  recommendations: string[];
  doctorName?: string;
  labName?: string;
  reportDate?: string;
  notes: string[];
}

/**
 * Builds a comprehensive clinical summary and analysis for any medical report
 * using AI extraction data when present, combined with deterministic biomarker range evaluation.
 */
export function buildReportAnalysis(
  document: MedicalDocument,
  observations: Observation[],
  extraction?: Extraction | null,
  _locale: string = "en"
): ReportAnalysisResult {
  void _locale;
  const structured = (extraction?.structured || {}) as Record<string, unknown>;

  const abnormalItems: ReportAnalysisResult["abnormalItems"] = [];
  const normalItems: ReportAnalysisResult["normalItems"] = [];
  let unspecifiedCount = 0;

  for (const obs of observations) {
    const rangeComparison = compareToSourceRange(obs.value, obs.referenceRange);
    const numVal = Number.parseFloat(obs.value);

    if (rangeComparison === "in_range") {
      normalItems.push({
        name: obs.name,
        value: obs.value,
        unit: obs.unit,
        referenceRange: obs.referenceRange,
      });
    } else if (rangeComparison === "out_of_range") {
      // Determine if elevated or low if referenceRange has upper/lower bounds
      let status: "elevated" | "low" | "out_of_range" = "out_of_range";
      if (obs.referenceRange && !Number.isNaN(numVal)) {
        const parts = obs.referenceRange.split(/[-–—]/).map((p) => Number.parseFloat(p.trim()));
        if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
          if (numVal > parts[1]) status = "elevated";
          else if (numVal < parts[0]) status = "low";
        } else if (obs.referenceRange.includes("<") && !Number.isNaN(numVal)) {
          const limit = Number.parseFloat(obs.referenceRange.replace("<", "").trim());
          if (!Number.isNaN(limit) && numVal > limit) status = "elevated";
        } else if (obs.referenceRange.includes(">") && !Number.isNaN(numVal)) {
          const limit = Number.parseFloat(obs.referenceRange.replace(">", "").trim());
          if (!Number.isNaN(limit) && numVal < limit) status = "low";
        }
      }
      abnormalItems.push({
        name: obs.name,
        value: obs.value,
        unit: obs.unit,
        referenceRange: obs.referenceRange,
        status,
      });
    } else {
      unspecifiedCount++;
    }
  }

  const totalTests = observations.length;
  const normalCount = normalItems.length;
  const abnormalCount = abnormalItems.length;

  let overallStatus: ReportAnalysisResult["overallStatus"] = "normal";
  if (abnormalCount > 0) {
    overallStatus = "abnormal_findings";
  } else if (totalTests === 0) {
    overallStatus = document.processingStatus === "pending" ? "pending" : "needs_review";
  }

  // Extract structured names & dates
  const doctorName =
    (typeof structured.doctorName === "string" && structured.doctorName.trim()) || undefined;
  const labName =
    (typeof structured.labName === "string" && structured.labName.trim()) || undefined;
  const reportDate =
    (typeof structured.reportDate === "string" && structured.reportDate.trim()) ||
    document.sourceDate ||
    document.createdAt.slice(0, 10);

  // Recommendations and suggested questions
  const suggestedQuestions: string[] = [];
  const recommendations: string[] = [];

  if (abnormalItems.length > 0) {
    const names = abnormalItems.map((a) => a.name).join(", ");
    suggestedQuestions.push(`What are the clinical implications of my out-of-range ${names}?`);
    suggestedQuestions.push(`Do I need a repeat test or additional diagnostic evaluation?`);
    suggestedQuestions.push(`Are there dietary, lifestyle, or medication adjustments you recommend based on these results?`);
    recommendations.push(`Schedule a clinical consultation with your doctor to review the out-of-range values: ${names}.`);
    recommendations.push(`Keep this report accessible for your next physician appointment.`);
  } else if (totalTests > 0) {
    suggestedQuestions.push(`Are my current test results consistent with my ongoing health maintenance goals?`);
    suggestedQuestions.push(`When should my next routine screening or laboratory panel be scheduled?`);
    recommendations.push(`All measured biomarkers are within expected standard laboratory reference ranges.`);
    recommendations.push(`Continue current balanced diet, physical activity, and prescribed wellness routine.`);
  } else {
    suggestedQuestions.push(`Could you help interpret the findings in this medical document?`);
    recommendations.push(`Check if all values were captured, or use the Add Test option to record specific biomarkers.`);
  }

  // Construct comprehensive summary text
  let summary = "";
  const aiSummary =
    (typeof structured.dischargeSummary === "string" && structured.dischargeSummary.trim()) ||
    (typeof structured.prescriptionSummary === "string" && structured.prescriptionSummary.trim());

  if (aiSummary) {
    summary = aiSummary;
  } else {
    // Grounded synthesis from observations & metadata
    const docTitle = document.displayName.replace(/\.[^/.]+$/, "");
    const parts: string[] = [];

    parts.push(`Clinical Report Summary for "${docTitle}" (${document.category.replace("_", " ")}).`);
    if (labName || doctorName) {
      const facility = [labName, doctorName ? `Prescriber/Doctor: ${doctorName}` : ""]
        .filter(Boolean)
        .join(" | ");
      parts.push(`Facility / Clinician: ${facility}.`);
    }

    if (totalTests > 0) {
      parts.push(
        `This report evaluates ${totalTests} clinical biomarker${totalTests > 1 ? "s" : ""}. ` +
          `${normalCount} parameter${normalCount === 1 ? " is" : "s are"} within normal reference ranges, and ` +
          `${abnormalCount} parameter${abnormalCount === 1 ? " is" : "s are"} outside expected limits.`
      );

      if (abnormalCount > 0) {
        const details = abnormalItems
          .map((a) => `${a.name}: ${a.value} ${a.unit} (${a.status.toUpperCase()}, range: ${a.referenceRange || "not specified"})`)
          .join("; ");
        parts.push(`Attention Areas: ${details}.`);
      } else {
        parts.push(`All analyzed parameters are within standard reference ranges.`);
      }
    } else {
      parts.push(`Document was uploaded and recorded into your health timeline.`);
    }

    parts.push(`Note: This summary is strictly informational and grounded in your uploaded report. Discuss all findings with your treating physician.`);
    summary = parts.join(" ");
  }

  const translatedSummary =
    typeof structured.translatedSummary === "string" && structured.translatedSummary.trim()
      ? structured.translatedSummary
      : undefined;

  const notes = [
    ...(Array.isArray(structured.notes) ? (structured.notes as string[]) : []),
    ...(document.processingNote ? [document.processingNote] : []),
  ];

  return {
    summary,
    translatedSummary,
    overallStatus,
    totalTests,
    normalCount,
    abnormalCount,
    unspecifiedCount,
    abnormalItems,
    normalItems,
    suggestedQuestions,
    recommendations,
    doctorName,
    labName,
    reportDate,
    notes,
  };
}
