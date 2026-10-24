import type { Observation, Medication, MedicalDocument } from "@/lib/db/types";
import { compareToSourceRange, type RangeStatus } from "./ranges";

export type DiagnosticPanel =
  | "all"
  | "metabolic"
  | "lipid"
  | "cbc"
  | "renal"
  | "hepatic"
  | "vitals"
  | "thyroid"
  | "vitamins"
  | "other";

export interface BiomarkerDataPoint {
  id: string;
  documentId: string;
  documentName: string;
  date: string;
  value: string;
  numericValue: number | null;
  unit: string;
  referenceRange?: string;
  status: RangeStatus;
  verificationStatus: "unconfirmed" | "confirmed" | "rejected";
  provenance: string;
}

export interface BiomarkerTrend {
  name: string;
  normalizedName: string;
  panel: DiagnosticPanel;
  unit: string;
  referenceRange?: string;
  pointsCount: number;
  dataPoints: BiomarkerDataPoint[];
  baselinePoint: BiomarkerDataPoint;
  latestPoint: BiomarkerDataPoint;
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  direction: "improving" | "elevated" | "low" | "stable" | "neutral";
  overallStatus: RangeStatus;
  reportsInvolved: { id: string; name: string; date: string }[];
}

export interface MedicationCorrelation {
  medicationName: string;
  strength: string;
  status: string;
  instructions: string;
  startDate?: string;
  relatedBiomarkers: {
    biomarkerName: string;
    baselineValue: string;
    latestValue: string;
    changeText: string;
    clinicalNote: string;
  }[];
}

export interface MultiReportAnalyticsSummary {
  totalReportsCount: number;
  totalBiomarkersCount: number;
  inRangeCount: number;
  outOfRangeCount: number;
  improvingCount: number;
  reportsList: { id: string; name: string; date: string; category: string }[];
}

export interface MultiReportAnalyticsResult {
  summary: MultiReportAnalyticsSummary;
  biomarkers: BiomarkerTrend[];
  medicationCorrelations: MedicationCorrelation[];
  insights: string[];
}

interface NormalizationRule {
  normalizedKey: string;
  standardName: string;
  panel: DiagnosticPanel;
  regex: RegExp;
}

const NORMALIZATION_RULES: NormalizationRule[] = [
  // Metabolic & Glycemic
  {
    normalizedKey: "fasting_glucose",
    standardName: "Fasting Blood Glucose",
    panel: "metabolic",
    regex: /\b(fasting (blood )?(glucose|sugar)|fbs|blood sugar (fasting|f))\b/i,
  },
  {
    normalizedKey: "postprandial_glucose",
    standardName: "Postprandial Blood Glucose (PPBS)",
    panel: "metabolic",
    regex: /\b(postprandial|ppbs|pp (blood )?(sugar|glucose)|post-meal sugar)\b/i,
  },
  {
    normalizedKey: "random_glucose",
    standardName: "Random Blood Sugar",
    panel: "metabolic",
    regex: /\b(random (blood )?(sugar|glucose)|rbs)\b/i,
  },
  {
    normalizedKey: "hba1c",
    standardName: "HbA1c (Glycated Hemoglobin)",
    panel: "metabolic",
    regex: /\b(hba1c|glycated hemoglobin|glycosylated hemoglobin)\b/i,
  },
  {
    normalizedKey: "fasting_insulin",
    standardName: "Fasting Insulin",
    panel: "metabolic",
    regex: /\b(fasting insulin|serum insulin)\b/i,
  },

  // Lipid Profile
  {
    normalizedKey: "total_cholesterol",
    standardName: "Total Cholesterol",
    panel: "lipid",
    regex: /\b(total cholesterol|serum cholesterol|cholesterol total)\b/i,
  },
  {
    normalizedKey: "triglycerides",
    standardName: "Serum Triglycerides",
    panel: "lipid",
    regex: /\b(triglyceride|triglycerides|tg|serum triglycerides)\b/i,
  },
  {
    normalizedKey: "hdl_cholesterol",
    standardName: "HDL Cholesterol (Good)",
    panel: "lipid",
    regex: /\b(hdl|hdl cholesterol|high density lipoprotein)\b/i,
  },
  {
    normalizedKey: "ldl_cholesterol",
    standardName: "LDL Cholesterol (Bad)",
    panel: "lipid",
    regex: /\b(ldl|ldl cholesterol|low density lipoprotein)\b/i,
  },
  {
    normalizedKey: "vldl_cholesterol",
    standardName: "VLDL Cholesterol",
    panel: "lipid",
    regex: /\b(vldl|vldl cholesterol|very low density lipoprotein)\b/i,
  },

  // Complete Blood Count (CBC)
  {
    normalizedKey: "hemoglobin",
    standardName: "Hemoglobin (Hb)",
    panel: "cbc",
    regex: /\b(hemoglobin|haemoglobin|hb)\b/i,
  },
  {
    normalizedKey: "total_wbc",
    standardName: "Total Leukocyte Count (WBC)",
    panel: "cbc",
    regex: /\b(wbc|tlc|total leukocyte count|total leucocyte count|white blood (cell|count))\b/i,
  },
  {
    normalizedKey: "platelet_count",
    standardName: "Platelet Count",
    panel: "cbc",
    regex: /\b(platelet|platelets|platelet count|thrombocytes)\b/i,
  },
  {
    normalizedKey: "rbc_count",
    standardName: "Red Blood Cell Count (RBC)",
    panel: "cbc",
    regex: /\b(rbc|rbc count|red blood (cell|count)|total rbc)\b/i,
  },
  {
    normalizedKey: "hematocrit",
    standardName: "Hematocrit (PCV)",
    panel: "cbc",
    regex: /\b(hematocrit|haematocrit|pcv|packed cell volume)\b/i,
  },
  {
    normalizedKey: "mcv",
    standardName: "Mean Corpuscular Volume (MCV)",
    panel: "cbc",
    regex: /\bmcv\b/i,
  },
  {
    normalizedKey: "esr",
    standardName: "Erythrocyte Sedimentation Rate (ESR)",
    panel: "cbc",
    regex: /\b(esr|erythrocyte sedimentation rate)\b/i,
  },

  // Renal & Kidney Function
  {
    normalizedKey: "serum_creatinine",
    standardName: "Serum Creatinine",
    panel: "renal",
    regex: /\b(creatinine|serum creatinine)\b/i,
  },
  {
    normalizedKey: "blood_urea",
    standardName: "Blood Urea / BUN",
    panel: "renal",
    regex: /\b(blood urea nitrogen|bun|urea|blood urea)\b/i,
  },
  {
    normalizedKey: "uric_acid",
    standardName: "Uric Acid",
    panel: "renal",
    regex: /\b(uric acid|serum uric acid)\b/i,
  },
  {
    normalizedKey: "egfr",
    standardName: "Estimated GFR (eGFR)",
    panel: "renal",
    regex: /\b(egfr|gfr|estimated glomerular filtration rate)\b/i,
  },
  {
    normalizedKey: "serum_sodium",
    standardName: "Serum Sodium (Electrolytes)",
    panel: "renal",
    regex: /\b(sodium|na\+|serum sodium)\b/i,
  },
  {
    normalizedKey: "serum_potassium",
    standardName: "Serum Potassium (Electrolytes)",
    panel: "renal",
    regex: /\b(potassium|k\+|serum potassium)\b/i,
  },

  // Hepatic & Liver Function
  {
    normalizedKey: "total_bilirubin",
    standardName: "Total Bilirubin",
    panel: "hepatic",
    regex: /\b(total bilirubin|bilirubin total|serum bilirubin)\b/i,
  },
  {
    normalizedKey: "sgpt_alt",
    standardName: "SGPT (ALT)",
    panel: "hepatic",
    regex: /\b(sgpt|alt|alanine aminotransferase|alanine transaminase)\b/i,
  },
  {
    normalizedKey: "sgot_ast",
    standardName: "SGOT (AST)",
    panel: "hepatic",
    regex: /\b(sgot|ast|aspartate aminotransferase|aspartate transaminase)\b/i,
  },
  {
    normalizedKey: "alkaline_phosphatase",
    standardName: "Alkaline Phosphatase (ALP)",
    panel: "hepatic",
    regex: /\b(alkaline phosphatase|alp)\b/i,
  },
  {
    normalizedKey: "total_protein",
    standardName: "Total Protein (Liver Panel)",
    panel: "hepatic",
    regex: /\b(total protein|protein total)\b/i,
  },
  {
    normalizedKey: "serum_albumin",
    standardName: "Serum Albumin",
    panel: "hepatic",
    regex: /\b(albumin|serum albumin)\b/i,
  },

  // Vitals & Hemodynamics
  {
    normalizedKey: "blood_pressure",
    standardName: "Blood Pressure",
    panel: "vitals",
    regex: /\b(blood pressure|bp|systolic|diastolic)\b/i,
  },
  {
    normalizedKey: "heart_rate",
    standardName: "Heart Rate / Pulse",
    panel: "vitals",
    regex: /\b(heart rate|pulse|pulse rate|bpm)\b/i,
  },
  {
    normalizedKey: "spo2",
    standardName: "Oxygen Saturation (SpO2)",
    panel: "vitals",
    regex: /\b(spo2|oxygen saturation|o2 sat)\b/i,
  },
  {
    normalizedKey: "temperature",
    standardName: "Body Temperature",
    panel: "vitals",
    regex: /\b(body temperature|temperature|fever temp)\b/i,
  },
  {
    normalizedKey: "body_weight",
    standardName: "Body Weight / BMI",
    panel: "vitals",
    regex: /\b(body weight|weight|bmi|body mass index)\b/i,
  },

  // Thyroid & Hormones
  {
    normalizedKey: "tsh",
    standardName: "Thyroid Stimulating Hormone (TSH)",
    panel: "thyroid",
    regex: /\b(tsh|thyroid stimulating hormone|ultrasensitive tsh)\b/i,
  },
  {
    normalizedKey: "free_t3",
    standardName: "Free Triiodothyronine (FT3)",
    panel: "thyroid",
    regex: /\b(free t3|ft3|t3)\b/i,
  },
  {
    normalizedKey: "free_t4",
    standardName: "Free Thyroxine (FT4)",
    panel: "thyroid",
    regex: /\b(free t4|ft4|t4)\b/i,
  },

  // Vitamins & Minerals
  {
    normalizedKey: "vitamin_d3",
    standardName: "Vitamin D (25-OH Cholecalciferol)",
    panel: "vitamins",
    regex: /\b(vitamin d|vitamin d3|25-hydroxy vitamin d|25-oh vitamin d)\b/i,
  },
  {
    normalizedKey: "vitamin_b12",
    standardName: "Vitamin B-12",
    panel: "vitamins",
    regex: /\b(vitamin b12|vitamin b-12|b12|cyanocobalamin)\b/i,
  },
  {
    normalizedKey: "serum_calcium",
    standardName: "Serum Calcium",
    panel: "vitamins",
    regex: /\b(calcium|serum calcium|ca2\+)\b/i,
  },
  {
    normalizedKey: "serum_ferritin",
    standardName: "Serum Ferritin",
    panel: "vitamins",
    regex: /\b(ferritin|serum ferritin)\b/i,
  },
];

export function normalizeBiomarker(rawName: string): {
  normalizedKey: string;
  standardName: string;
  panel: DiagnosticPanel;
} {
  const cleaned = rawName.trim();
  for (const rule of NORMALIZATION_RULES) {
    if (rule.regex.test(cleaned)) {
      return {
        normalizedKey: rule.normalizedKey,
        standardName: rule.standardName,
        panel: rule.panel,
      };
    }
  }

  // Fallback for unclassified observations
  const fallbackKey = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return {
    normalizedKey: fallbackKey,
    standardName: cleaned,
    panel: "other",
  };
}

export function parseNumericValue(valueStr: string): number | null {
  if (!valueStr) return null;
  // Handle blood pressure 120/80 -> take systolic for delta calculation or return null
  if (/^\s*\d{2,3}\s*\/\s*\d{2,3}\s*$/.test(valueStr)) {
    const match = valueStr.match(/^(\d+)/);
    return match ? Number(match[1]) : null;
  }
  const cleaned = valueStr.replace(/,/g, "").trim();
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function parseReferenceRangeBounds(rangeStr?: string): {
  lower: number | null;
  upper: number | null;
} {
  if (!rangeStr) return { lower: null, upper: null };
  const trimmed = rangeStr.trim();
  const rangeMatch = trimmed.match(/^([0-9.]+)\s*[-–—]\s*([0-9.]+)$/);
  if (rangeMatch) {
    return {
      lower: Number(rangeMatch[1]),
      upper: Number(rangeMatch[2]),
    };
  }
  const lessThanMatch = trimmed.match(/^(?:<|less than|up to)\s*([0-9.]+)$/i);
  if (lessThanMatch) {
    return {
      lower: null,
      upper: Number(lessThanMatch[1]),
    };
  }
  const greaterThanMatch = trimmed.match(/^(?:>|greater than)\s*([0-9.]+)$/i);
  if (greaterThanMatch) {
    return {
      lower: Number(greaterThanMatch[1]),
      upper: null,
    };
  }
  return { lower: null, upper: null };
}

export function determineDirection(
  baseline: BiomarkerDataPoint,
  latest: BiomarkerDataPoint,
  bounds: { lower: number | null; upper: number | null }
): "improving" | "elevated" | "low" | "stable" | "neutral" {
  if (baseline.numericValue === null || latest.numericValue === null) {
    return "neutral";
  }

  const latestStatus = latest.status;
  const baselineStatus = baseline.status;

  // Case 1: Latest is within normal reference range
  if (latestStatus === "in_range") {
    if (baselineStatus === "out_of_range") {
      return "improving";
    }
    return "stable";
  }

  // Case 2: Latest is outside normal reference range
  if (latestStatus === "out_of_range") {
    if (bounds.upper !== null && latest.numericValue > bounds.upper) {
      // Check if it was higher before and has dropped closer to upper bound
      if (
        baseline.numericValue > bounds.upper &&
        latest.numericValue < baseline.numericValue
      ) {
        return "improving";
      }
      return "elevated";
    }
    if (bounds.lower !== null && latest.numericValue < bounds.lower) {
      // Check if it was lower before and has risen closer to lower bound
      if (
        baseline.numericValue < bounds.lower &&
        latest.numericValue > baseline.numericValue
      ) {
        return "improving";
      }
      return "low";
    }
    return "elevated";
  }

  // Case 3: Range unavailable
  if (Math.abs(latest.numericValue - baseline.numericValue) < 0.001) {
    return "stable";
  }
  return "neutral";
}

const MEDICATION_CORRELATION_MAP: {
  medicationRegex: RegExp;
  biomarkers: {
    normalizedKey: string;
    clinicalNote: string;
  }[];
}[] = [
  {
    medicationRegex: /\b(metformin|glimepiride|vildagliptin|sitagliptin|dapagliflozin|empagliflozin|insulin|teneligliptin)\b/i,
    biomarkers: [
      {
        normalizedKey: "fasting_glucose",
        clinicalNote: "Glycemic control therapy directly impacts fasting blood sugar levels.",
      },
      {
        normalizedKey: "hba1c",
        clinicalNote: "Long-term glycemic therapy reflects in 3-month HbA1c trajectory.",
      },
    ],
  },
  {
    medicationRegex: /\b(atorvastatin|rosuvastatin|simvastatin|fenofibrate|ezetimibe)\b/i,
    biomarkers: [
      {
        normalizedKey: "total_cholesterol",
        clinicalNote: "Statin / lipid-lowering therapy targets total circulating cholesterol.",
      },
      {
        normalizedKey: "ldl_cholesterol",
        clinicalNote: "Key therapeutic target for cardiovascular risk reduction.",
      },
      {
        normalizedKey: "triglycerides",
        clinicalNote: "Fibrate or statin therapy helps lower elevated triglyceride levels.",
      },
    ],
  },
  {
    medicationRegex: /\b(telmisartan|amlodipine|losartan|enalapril|ramipril|metoprolol|atenolol|olmesartan|cilnidipine)\b/i,
    biomarkers: [
      {
        normalizedKey: "blood_pressure",
        clinicalNote: "Antihypertensive medication maintains hemodynamic pressure within target bounds.",
      },
      {
        normalizedKey: "serum_creatinine",
        clinicalNote: "Renal monitoring is standard when on ACE inhibitors or ARB therapy.",
      },
    ],
  },
  {
    medicationRegex: /\b(levothyroxine|thyronorm|eltroxin)\b/i,
    biomarkers: [
      {
        normalizedKey: "tsh",
        clinicalNote: "Thyroid hormone replacement titrates TSH into euthyroid range.",
      },
    ],
  },
  {
    medicationRegex: /\b(vitamin d|vitamin d3|cholecalciferol|calcium|shelcal)\b/i,
    biomarkers: [
      {
        normalizedKey: "vitamin_d3",
        clinicalNote: "Oral vitamin D supplementation restores bone health and deficiency.",
      },
      {
        normalizedKey: "serum_calcium",
        clinicalNote: "Calcium balance works synergistically with vitamin D3.",
      },
    ],
  },
  {
    medicationRegex: /\b(iron|ferrous|folvite|autrin|orofer)\b/i,
    biomarkers: [
      {
        normalizedKey: "hemoglobin",
        clinicalNote: "Hematinic therapy elevates hemoglobin synthesis over several weeks.",
      },
      {
        normalizedKey: "serum_ferritin",
        clinicalNote: "Reflects replenishment of depleted bone marrow iron stores.",
      },
    ],
  },
];

export function generateMultiReportAnalytics(input: {
  observations: Observation[];
  documents: MedicalDocument[];
  medications?: Medication[];
}): MultiReportAnalyticsResult {
  const { observations, documents, medications = [] } = input;

  const docMap = new Map<string, { id: string; name: string; date: string; category: string }>();
  for (const doc of documents) {
    docMap.set(doc.id, {
      id: doc.id,
      name: doc.displayName,
      date: doc.sourceDate || doc.createdAt.slice(0, 10),
      category: doc.category,
    });
  }

  // Filter only confirmed observations
  const confirmedObs = observations.filter((o) => o.verificationStatus === "confirmed");

  // Group by normalized biomarker key
  const groups = new Map<
    string,
    {
      normalizedKey: string;
      standardName: string;
      panel: DiagnosticPanel;
      unit: string;
      referenceRange?: string;
      points: BiomarkerDataPoint[];
    }
  >();

  for (const obs of confirmedObs) {
    const { normalizedKey, standardName, panel } = normalizeBiomarker(obs.name);
    const docInfo = docMap.get(obs.documentId);
    const date = obs.sourceDate || obs.createdAt.slice(0, 10);
    const docName = docInfo ? docInfo.name : "Uploaded Diagnostic Report";
    const status = compareToSourceRange(obs.value, obs.referenceRange);
    const num = parseNumericValue(obs.value);

    const point: BiomarkerDataPoint = {
      id: obs.id,
      documentId: obs.documentId,
      documentName: docName,
      date,
      value: obs.value,
      numericValue: num,
      unit: obs.unit,
      referenceRange: obs.referenceRange,
      status,
      verificationStatus: obs.verificationStatus,
      provenance: obs.provenance,
    };

    if (!groups.has(normalizedKey)) {
      groups.set(normalizedKey, {
        normalizedKey,
        standardName,
        panel,
        unit: obs.unit,
        referenceRange: obs.referenceRange,
        points: [point],
      });
    } else {
      const g = groups.get(normalizedKey)!;
      g.points.push(point);
      if (!g.referenceRange && obs.referenceRange) {
        g.referenceRange = obs.referenceRange;
      }
    }
  }

  const biomarkerTrends: BiomarkerTrend[] = [];

  for (const group of groups.values()) {
    // Sort points chronologically
    const sortedPoints = [...group.points].sort((a, b) => a.date.localeCompare(b.date));

    const baselinePoint = sortedPoints[0];
    const latestPoint = sortedPoints[sortedPoints.length - 1];

    let deltaAbsolute: number | null = null;
    let deltaPercent: number | null = null;

    if (baselinePoint.numericValue !== null && latestPoint.numericValue !== null) {
      deltaAbsolute = Number((latestPoint.numericValue - baselinePoint.numericValue).toFixed(2));
      if (baselinePoint.numericValue !== 0) {
        deltaPercent = Number(
          (((latestPoint.numericValue - baselinePoint.numericValue) / baselinePoint.numericValue) * 100).toFixed(1)
        );
      }
    }

    const bounds = parseReferenceRangeBounds(latestPoint.referenceRange || group.referenceRange);
    const direction = determineDirection(baselinePoint, latestPoint, bounds);

    const uniqueReports = Array.from(
      new Map(
        sortedPoints.map((p) => [
          p.documentId,
          { id: p.documentId, name: p.documentName, date: p.date },
        ])
      ).values()
    );

    biomarkerTrends.push({
      name: group.standardName,
      normalizedName: group.normalizedKey,
      panel: group.panel,
      unit: group.unit,
      referenceRange: latestPoint.referenceRange || group.referenceRange,
      pointsCount: sortedPoints.length,
      dataPoints: sortedPoints,
      baselinePoint,
      latestPoint,
      deltaAbsolute,
      deltaPercent,
      direction,
      overallStatus: latestPoint.status,
      reportsInvolved: uniqueReports,
    });
  }

  // Sort biomarker trends: out of range first, then multi-report points first
  biomarkerTrends.sort((a, b) => {
    if (a.overallStatus === "out_of_range" && b.overallStatus !== "out_of_range") return -1;
    if (b.overallStatus === "out_of_range" && a.overallStatus !== "out_of_range") return 1;
    return b.pointsCount - a.pointsCount;
  });

  // Calculate summary counts
  const distinctReports = Array.from(docMap.values());
  const totalReportsCount = distinctReports.length;
  const totalBiomarkersCount = biomarkerTrends.length;
  const inRangeCount = biomarkerTrends.filter((b) => b.overallStatus === "in_range").length;
  const outOfRangeCount = biomarkerTrends.filter((b) => b.overallStatus === "out_of_range").length;
  const improvingCount = biomarkerTrends.filter((b) => b.direction === "improving").length;

  // Correlate with active medications
  const medicationCorrelations: MedicationCorrelation[] = [];
  for (const med of medications) {
    if (med.status !== "active") continue;
    for (const rule of MEDICATION_CORRELATION_MAP) {
      if (rule.medicationRegex.test(med.name)) {
        const related: MedicationCorrelation["relatedBiomarkers"] = [];
        for (const rel of rule.biomarkers) {
          const match = biomarkerTrends.find((b) => b.normalizedName === rel.normalizedKey);
          if (match) {
            let changeText = "Single record tracked";
            if (match.pointsCount > 1 && match.deltaPercent !== null) {
              const sign = match.deltaPercent > 0 ? "+" : "";
              changeText = `${sign}${match.deltaPercent}% (${match.baselinePoint.value} → ${match.latestPoint.value} ${match.unit})`;
            } else if (match.latestPoint) {
              changeText = `Latest: ${match.latestPoint.value} ${match.unit}`;
            }

            related.push({
              biomarkerName: match.name,
              baselineValue: `${match.baselinePoint.value} ${match.unit}`,
              latestValue: `${match.latestPoint.value} ${match.unit}`,
              changeText,
              clinicalNote: rel.clinicalNote,
            });
          }
        }

        if (related.length > 0) {
          medicationCorrelations.push({
            medicationName: med.name,
            strength: med.strength || "",
            status: med.status,
            instructions: med.instructions || "",
            relatedBiomarkers: related,
          });
        }
      }
    }
  }

  // Synthesize clinical insights
  const insights: string[] = [];

  if (outOfRangeCount > 0) {
    const outNames = biomarkerTrends
      .filter((b) => b.overallStatus === "out_of_range")
      .map((b) => b.name)
      .slice(0, 3)
      .join(", ");
    insights.push(
      `${outOfRangeCount} biomarker${outOfRangeCount > 1 ? "s are" : " is"} currently outside expected clinical reference ranges (${outNames}). Review these with your clinician.`
    );
  } else if (totalBiomarkersCount > 0) {
    insights.push(
      "All tracked laboratory parameters are currently within normal baseline reference intervals."
    );
  }

  if (improvingCount > 0) {
    const improvingNames = biomarkerTrends
      .filter((b) => b.direction === "improving")
      .map((b) => b.name)
      .slice(0, 2)
      .join(" and ");
    insights.push(
      `Positive clinical trajectory observed in ${improvingNames} moving toward normal healthy limits across comparative reports.`
    );
  }

  if (medicationCorrelations.length > 0) {
    const medNames = medicationCorrelations.map((m) => m.medicationName).slice(0, 2).join(", ");
    insights.push(
      `Active therapy (${medNames}) correlates with longitudinal monitoring in corresponding metabolic/hemodynamic panels.`
    );
  }

  return {
    summary: {
      totalReportsCount,
      totalBiomarkersCount,
      inRangeCount,
      outOfRangeCount,
      improvingCount,
      reportsList: distinctReports,
    },
    biomarkers: biomarkerTrends,
    medicationCorrelations,
    insights,
  };
}
