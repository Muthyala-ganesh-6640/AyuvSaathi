import { describe, it, expect } from "vitest";
import {
  normalizeBiomarker,
  parseNumericValue,
  parseReferenceRangeBounds,
  determineDirection,
  generateMultiReportAnalytics,
} from "./multi-report-analytics";
import type { Observation, MedicalDocument, Medication } from "@/lib/db/types";

describe("Multi-Report Health Analytics Engine", () => {
  it("normalizes various clinical biomarker naming conventions and assigns correct panels", () => {
    const fbs = normalizeBiomarker("Fasting Blood Sugar");
    expect(fbs.normalizedKey).toBe("fasting_glucose");
    expect(fbs.panel).toBe("metabolic");

    const hba1c = normalizeBiomarker("HbA1c (Glycated Hemoglobin)");
    expect(hba1c.normalizedKey).toBe("hba1c");
    expect(hba1c.panel).toBe("metabolic");

    const lipid = normalizeBiomarker("Total Serum Cholesterol");
    expect(lipid.normalizedKey).toBe("total_cholesterol");
    expect(lipid.panel).toBe("lipid");

    const cbc = normalizeBiomarker("Hemoglobin");
    expect(cbc.normalizedKey).toBe("hemoglobin");
    expect(cbc.panel).toBe("cbc");

    const renal = normalizeBiomarker("Serum Creatinine");
    expect(renal.normalizedKey).toBe("serum_creatinine");
    expect(renal.panel).toBe("renal");

    const hepatic = normalizeBiomarker("SGPT (ALT)");
    expect(hepatic.normalizedKey).toBe("sgpt_alt");
    expect(hepatic.panel).toBe("hepatic");

    const vitals = normalizeBiomarker("Blood Pressure");
    expect(vitals.normalizedKey).toBe("blood_pressure");
    expect(vitals.panel).toBe("vitals");
  });

  it("accurately parses numeric values including floats, commas, and blood pressure", () => {
    expect(parseNumericValue("104.5")).toBe(104.5);
    expect(parseNumericValue("1,200")).toBe(1200);
    expect(parseNumericValue("126/82")).toBe(126);
    expect(parseNumericValue("")).toBeNull();
  });

  it("parses reference range bounds", () => {
    expect(parseReferenceRangeBounds("70-99")).toEqual({ lower: 70, upper: 99 });
    expect(parseReferenceRangeBounds("< 200")).toEqual({ lower: null, upper: 200 });
    expect(parseReferenceRangeBounds("> 50")).toEqual({ lower: 50, upper: null });
  });

  it("determines trajectory direction correctly", () => {
    const baselineOut = {
      id: "1",
      documentId: "d1",
      documentName: "Report 1",
      date: "2026-01-01",
      value: "140",
      numericValue: 140,
      unit: "mg/dL",
      referenceRange: "70-99",
      status: "out_of_range" as const,
      verificationStatus: "confirmed" as const,
      provenance: "source_document",
    };

    const latestIn = {
      id: "2",
      documentId: "d2",
      documentName: "Report 2",
      date: "2026-03-01",
      value: "95",
      numericValue: 95,
      unit: "mg/dL",
      referenceRange: "70-99",
      status: "in_range" as const,
      verificationStatus: "confirmed" as const,
      provenance: "source_document",
    };

    const bounds = { lower: 70, upper: 99 };
    expect(determineDirection(baselineOut, latestIn, bounds)).toBe("improving");
  });

  it("processes multiple reports, computes deltas, and detects medication correlations", () => {
    const doc1: MedicalDocument = {
      id: "doc-1",
      ownerId: "user-1",
      category: "lab_report",
      storagePath: "",
      displayName: "Apollo Diagnostics - Baseline CMP",
      mimeType: "application/pdf",
      fileSize: 1024,
      uploadStatus: "uploaded",
      processingStatus: "extracted",
      sourceDate: "2026-01-10",
      createdAt: "2026-01-10T10:00:00Z",
      updatedAt: "2026-01-10T10:00:00Z",
    };

    const doc2: MedicalDocument = {
      id: "doc-2",
      ownerId: "user-1",
      category: "lab_report",
      storagePath: "",
      displayName: "Max Lab - Follow-up CMP",
      mimeType: "application/pdf",
      fileSize: 1024,
      uploadStatus: "uploaded",
      processingStatus: "extracted",
      sourceDate: "2026-03-15",
      createdAt: "2026-03-15T10:00:00Z",
      updatedAt: "2026-03-15T10:00:00Z",
    };

    const obs: Observation[] = [
      {
        id: "obs-1",
        ownerId: "user-1",
        documentId: "doc-1",
        name: "Fasting Blood Glucose",
        value: "135",
        unit: "mg/dL",
        referenceRange: "70-99",
        sourceDate: "2026-01-10",
        uncertain: false,
        verificationStatus: "confirmed",
        provenance: "source_document",
        createdAt: "2026-01-10T10:00:00Z",
        updatedAt: "2026-01-10T10:00:00Z",
      },
      {
        id: "obs-2",
        ownerId: "user-1",
        documentId: "doc-2",
        name: "Fasting Glucose",
        value: "98",
        unit: "mg/dL",
        referenceRange: "70-99",
        sourceDate: "2026-03-15",
        uncertain: false,
        verificationStatus: "confirmed",
        provenance: "source_document",
        createdAt: "2026-03-15T10:00:00Z",
        updatedAt: "2026-03-15T10:00:00Z",
      },
      {
        id: "obs-3",
        ownerId: "user-1",
        documentId: "doc-1",
        name: "Total Cholesterol",
        value: "220",
        unit: "mg/dL",
        referenceRange: "< 200",
        sourceDate: "2026-01-10",
        uncertain: false,
        verificationStatus: "confirmed",
        provenance: "source_document",
        createdAt: "2026-01-10T10:00:00Z",
        updatedAt: "2026-01-10T10:00:00Z",
      },
    ];

    const meds: Medication[] = [
      {
        id: "med-1",
        ownerId: "user-1",
        name: "Metformin Hydrochloride",
        strength: "500 mg",
        instructions: "Take once daily with dinner",
        status: "active",
        confirmationStatus: "confirmed",
        provenance: "source_document",
        createdAt: "2026-01-12T10:00:00Z",
        updatedAt: "2026-01-12T10:00:00Z",
      },
    ];

    const analytics = generateMultiReportAnalytics({
      observations: obs,
      documents: [doc1, doc2],
      medications: meds,
    });

    expect(analytics.summary.totalReportsCount).toBe(2);
    expect(analytics.summary.totalBiomarkersCount).toBe(2); // Fasting glucose grouped, plus Cholesterol
    expect(analytics.summary.improvingCount).toBe(1);

    const glucoseTrend = analytics.biomarkers.find((b) => b.normalizedName === "fasting_glucose");
    expect(glucoseTrend).toBeDefined();
    expect(glucoseTrend?.pointsCount).toBe(2);
    expect(glucoseTrend?.baselinePoint.value).toBe("135");
    expect(glucoseTrend?.latestPoint.value).toBe("98");
    expect(glucoseTrend?.deltaAbsolute).toBe(-37);
    expect(glucoseTrend?.direction).toBe("improving");
    expect(glucoseTrend?.reportsInvolved.length).toBe(2);

    expect(analytics.medicationCorrelations.length).toBe(1);
    expect(analytics.medicationCorrelations[0].medicationName).toBe("Metformin Hydrochloride");
    expect(analytics.medicationCorrelations[0].relatedBiomarkers[0].biomarkerName).toContain("Fasting Blood Glucose");
  });
});
