import { describe, it, expect } from "vitest";
import { groundedAnswer } from "./grounded";
import type { Observation } from "@/lib/db/types";

describe("Grounded Clinical Assistant", () => {
  const sampleObservations: Observation[] = [
    {
      id: "obs-1",
      ownerId: "user-1",
      documentId: "doc-1",
      name: "Hemoglobin",
      value: "14.2",
      unit: "g/dL",
      referenceRange: "12.0-15.0",
      uncertain: false,
      verificationStatus: "confirmed",
      provenance: "source_document",
      createdAt: "2026-10-11T00:00:00Z",
      updatedAt: "2026-10-11T00:00:00Z",
    },
    {
      id: "obs-2",
      ownerId: "user-1",
      documentId: "doc-1",
      name: "Total Cholesterol",
      value: "220",
      unit: "mg/dL",
      referenceRange: "<200",
      uncertain: false,
      verificationStatus: "confirmed",
      provenance: "source_document",
      createdAt: "2026-10-11T00:00:00Z",
      updatedAt: "2026-10-11T00:00:00Z",
    },
  ];

  it("produces grounded answer in English with disclaimer and source values", () => {
    const res = groundedAnswer("What is my hemoglobin level?", sampleObservations, "en");
    expect(res).toContain("Hemoglobin: 14.2 g/dL");
    expect(res).toContain("source range 12.0-15.0");
    expect(res).toContain("in range");
    expect(res).toContain("These facts come only from values you confirmed");
    expect(res).toContain("This is not a diagnosis");
    expect(res).toContain("Ask a qualified clinician how these results relate to your symptoms and history");
  });

  it("produces grounded answer strictly in English even if queried in other languages", () => {
    const resTe = groundedAnswer("హిమోగ్లోబిన్ ఎంత?", sampleObservations, "te");
    expect(resTe).toContain("Hemoglobin: 14.2 g/dL");
    expect(resTe).toContain("Ask a qualified clinician");
    expect(resTe).toContain("This is not a diagnosis");

    const resHi = groundedAnswer("हीमोग्लोबिन क्या है?", sampleObservations, "hi");
    expect(resHi).toContain("Hemoglobin: 14.2 g/dL");
    expect(resHi).toContain("Ask a qualified clinician");
  });

  it("deduplicates multiple observation entries with the same test name", () => {
    const duplicateObservations = [
      ...sampleObservations,
      {
        ...sampleObservations[0],
        id: "obs-3",
        createdAt: "2026-10-12T00:00:00Z",
      },
    ];
    const res = groundedAnswer("What is my hemoglobin level?", duplicateObservations, "en");
    const matches = res.match(/Hemoglobin: 14\.2 g\/dL/g);
    expect(matches?.length).toBe(1);
  });

  it("handles empty observations list safely with prompt in English to upload and verify", () => {
    const res = groundedAnswer("What are my results?", [], "en");
    expect(res).toContain("I do not have any patient-confirmed records yet");
    expect(res).toContain("Upload a lab report, prescription, or doctor summary first");
  });

  it("answers prescription and medication questions from GroundedContext", () => {
    const context = {
      observations: sampleObservations,
      medications: [
        {
          id: "med-1",
          ownerId: "user-1",
          name: "Metformin",
          strength: "500 mg",
          instructions: "Twice daily after meals. Take with water.",
          status: "active" as const,
          confirmationStatus: "confirmed" as const,
          provenance: "source_document" as const,
          createdAt: "2026-10-11T00:00:00Z",
          updatedAt: "2026-10-11T00:00:00Z",
        },
      ],
      visits: [],
      documents: [],
    };
    const res = groundedAnswer("What medications or prescriptions am I taking?", context, "en");
    expect(res).toContain("Metformin (500 mg)");
    expect(res).toContain("Twice daily after meals");
    expect(res).toContain("Take with water");
    expect(res).toContain("active");
  });

  it("answers doctor summary and clinical notes questions from GroundedContext", () => {
    const context = {
      observations: sampleObservations,
      medications: [],
      visits: [
        {
          id: "visit-1",
          ownerId: "user-1",
          title: "Dr. Arvind Rao (Endocrinology, Apollo Health City)",
          sourceIds: ["doc-1"],
          content: "Patient is adhering well to dietary changes. Diagnosed: Type 2 Diabetes Mellitus - Controlled. Repeat HbA1c in 3 months.",
          questions: ["Should I adjust my evening dose?"],
          createdAt: "2026-10-11T00:00:00Z",
          updatedAt: "2026-10-11T00:00:00Z",
        },
      ],
      documents: [],
    };
    const res = groundedAnswer("What did the doctor say in my consultation summary?", context, "en");
    expect(res).toContain("Dr. Arvind Rao (Endocrinology, Apollo Health City)");
    expect(res).toContain("Type 2 Diabetes Mellitus - Controlled");
    expect(res).toContain("Repeat HbA1c in 3 months");
    expect(res).toContain("Should I adjust my evening dose?");
  });
});