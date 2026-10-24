import type { Profile, Observation, Medication, DoctorPrescription, VisitSummary } from "@/lib/db/types";

export type WellnessCategory = "diet" | "activity" | "sleep" | "habits";

export interface WellnessRecommendation {
  id: string;
  category: WellnessCategory;
  title: string;
  advice: string;
  whyRecommended: string;
  evidenceTag: string;
  urgency: "high" | "medium" | "preventive";
  actionSteps: string[];
  disclaimer: string;
}

export interface WellnessProfileAnalysis {
  age: number;
  gender?: string;
  identifiedConditions: string[];
  keyBiomarkers: {
    name: string;
    value: string | number;
    unit: string;
    status: "normal" | "elevated" | "low";
  }[];
  recommendations: WellnessRecommendation[];
  overallWellnessScore: number;
  summary: string;
}

const GENERAL_DISCLAIMER =
  "These personalized suggestions provide general wellness, lifestyle, and nutritional guidance. Always consult your treating doctor or healthcare provider before altering your dietary regimen, starting intensive physical training, or modifying prescribed medications.";

function calculateAge(dateOfBirth?: string, fallbackAge?: number): number {
  if (fallbackAge && fallbackAge > 0) return fallbackAge;
  if (!dateOfBirth) return 42; // default adult baseline

  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 42;

  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

export function generateWellnessRecommendations(
  user: Profile,
  observations: Observation[] = [],
  medications: Medication[] = [],
  prescriptions: DoctorPrescription[] = [],
  visits: VisitSummary[] = []
): WellnessProfileAnalysis {
  const age = calculateAge(user.dateOfBirth, user.age);
  const recs: WellnessRecommendation[] = [];
  const identifiedConditions: Set<string> = new Set();
  const keyBiomarkers: WellnessProfileAnalysis["keyBiomarkers"] = [];

  // 1. Identify conditions from prescriptions & active medications
  const medNames = medications.map((m) => m.name.toLowerCase()).join(" ");
  const rxDiagnoses = prescriptions.map((p) => (p.diagnosis || "").toLowerCase()).join(" ");
  const visitContent = visits.map((v) => v.content.toLowerCase()).join(" ");
  const allClinicalText = `${medNames} ${rxDiagnoses} ${visitContent}`;

  const isDiabetic =
    allClinicalText.includes("diabetes") ||
    allClinicalText.includes("metformin") ||
    allClinicalText.includes("glimepiride") ||
    allClinicalText.includes("insulin") ||
    allClinicalText.includes("hba1c");
  if (isDiabetic) identifiedConditions.add("Type 2 Diabetes / Dysglycemia");

  const isHypertensive =
    allClinicalText.includes("hypertension") ||
    allClinicalText.includes("amlodipine") ||
    allClinicalText.includes("telmisartan") ||
    allClinicalText.includes("losartan") ||
    allClinicalText.includes("blood pressure") ||
    allClinicalText.includes("bp");
  if (isHypertensive) identifiedConditions.add("Hypertension / Blood Pressure Management");

  const isHyperlipidemia =
    allClinicalText.includes("cholesterol") ||
    allClinicalText.includes("atorvastatin") ||
    allClinicalText.includes("rosuvastatin") ||
    allClinicalText.includes("lipid") ||
    allClinicalText.includes("triglycerides");
  if (isHyperlipidemia) identifiedConditions.add("Dyslipidemia / Lipid Profile Management");

  const isThyroid =
    allClinicalText.includes("thyroid") ||
    allClinicalText.includes("hypothyroid") ||
    allClinicalText.includes("levothyroxine") ||
    allClinicalText.includes("thyronorm");
  if (isThyroid) identifiedConditions.add("Thyroid Health");

  const isAsthma =
    allClinicalText.includes("asthma") ||
    allClinicalText.includes("inhaler") ||
    allClinicalText.includes("budecort") ||
    allClinicalText.includes("foracort");
  if (isAsthma) identifiedConditions.add("Respiratory / Airway Wellness");

  // 2. Parse Test Values / Biomarkers
  let latestGlucose: number | null = null;
  let latestHbA1c: number | null = null;
  let latestSystolicBP: number | null = null;
  let latestDiastolicBP: number | null = null;
  let latestLDL: number | null = null;

  for (const obs of observations) {
    const name = obs.name.toLowerCase();
    const val = typeof obs.value === "number" ? obs.value : parseFloat(String(obs.value));

    if (name.includes("hba1c") && !isNaN(val)) {
      latestHbA1c = val;
      const status = val > 7.0 ? "elevated" : val < 5.7 ? "normal" : "elevated";
      keyBiomarkers.push({ name: "HbA1c", value: val, unit: "%", status });
    } else if ((name.includes("glucose") || name.includes("fasting sugar") || name.includes("fbs")) && !isNaN(val)) {
      latestGlucose = val;
      const status = val > 125 ? "elevated" : val < 70 ? "low" : "normal";
      keyBiomarkers.push({ name: "Fasting Glucose", value: val, unit: obs.unit || "mg/dL", status });
    } else if (name.includes("systolic") && !isNaN(val)) {
      latestSystolicBP = val;
      const status = val > 130 ? "elevated" : "normal";
      keyBiomarkers.push({ name: "Systolic BP", value: val, unit: "mmHg", status });
    } else if (name.includes("diastolic") && !isNaN(val)) {
      latestDiastolicBP = val;
      const status = val > 80 ? "elevated" : "normal";
      keyBiomarkers.push({ name: "Diastolic BP", value: val, unit: "mmHg", status });
    } else if (name.includes("ldl") && !isNaN(val)) {
      latestLDL = val;
      const status = val > 100 ? "elevated" : "normal";
      keyBiomarkers.push({ name: "LDL Cholesterol", value: val, unit: "mg/dL", status });
    }
  }

  // 3. Tailor Recommendations Based on Conditions, Biomarkers & Age

  // --- A. DIET RECOMMENDATIONS ---
  if (isDiabetic || (latestHbA1c && latestHbA1c >= 6.5) || (latestGlucose && latestGlucose > 125)) {
    const evidence = latestHbA1c
      ? `Recent HbA1c of ${latestHbA1c}%`
      : latestGlucose
      ? `Fasting Blood Sugar of ${latestGlucose} mg/dL`
      : "Active Glycemic Care History";

    recs.push({
      id: "diet-glycemic-balance",
      category: "diet",
      title: "Low-Glycemic Mediterranean-Style Diet",
      advice:
        "Prioritize complex whole grains (millet, oats, brown rice) and soluble dietary fiber over refined carbohydrates and sweetened beverages. Incorporate pulses, fenugreek, and non-starchy leafy vegetables.",
      whyRecommended: `Recommended because your records indicate ${evidence}. Soluble dietary fiber slows gastric emptying and glucose absorption, attenuating acute postprandial glycemic spikes.`,
      evidenceTag: evidence,
      urgency: "high",
      actionSteps: [
        "Include non-starchy vegetables (spinach, cucumber, methi) to cover half your plate at lunch and dinner.",
        "Replace refined white flour and polished white rice with high-fiber whole millets (jowar, ragi) or quinoa.",
        "Space meals at regular 4-5 hour intervals to prevent glycemic fluctuations.",
      ],
      disclaimer: GENERAL_DISCLAIMER,
    });
  }

  if (isHypertensive || (latestSystolicBP && latestSystolicBP > 130) || (latestDiastolicBP && latestDiastolicBP > 80)) {
    const bpText =
      latestSystolicBP && latestDiastolicBP
        ? `Recorded Blood Pressure: ${latestSystolicBP}/${latestDiastolicBP} mmHg`
        : "Diagnosed Hypertension History";

    recs.push({
      id: "diet-dash-sodium",
      category: "diet",
      title: "DASH Diet & Sodium Moderation",
      advice:
        "Limit dietary sodium to under 2,000 mg/day (approx. 1 teaspoon of table salt). Increase dietary potassium from natural sources including tender coconut water, bananas, tomatoes, and pumpkin seeds.",
      whyRecommended: `Recommended because your profile reflects ${bpText}. Moderating sodium reduces vascular fluid volume and peripheral vascular resistance, helping maintain healthy blood pressure naturally.`,
      evidenceTag: bpText,
      urgency: "high",
      actionSteps: [
        "Avoid high-sodium packaged foods, pickles, papads, and instant spice mixes.",
        "Enhance meal flavor using lemon juice, fresh herbs, garlic, and cumin rather than extra salt.",
        "Drink 2.0 to 2.5 liters of clean water daily to assist natural renal electrolyte regulation.",
      ],
      disclaimer: GENERAL_DISCLAIMER,
    });
  }

  if (isHyperlipidemia || (latestLDL && latestLDL > 100)) {
    const ldlText = latestLDL ? `LDL Cholesterol at ${latestLDL} mg/dL` : "Elevated Lipid Risk Markers";
    recs.push({
      id: "diet-heart-healthy-fats",
      category: "diet",
      title: "Heart-Healthy Monounsaturated Fats & Plant Sterols",
      advice:
        "Substitute saturated and trans-fats with cold-pressed olive or mustard oil, walnuts, almonds, and roasted flaxseeds rich in Alpha-Linolenic Acid (omega-3).",
      whyRecommended: `Recommended because your profile shows ${ldlText}. Plant-derived unsaturated fatty acids and soluble beta-glucans help maintain an optimal lipid balance and arterial endothelial health.`,
      evidenceTag: ldlText,
      urgency: "medium",
      actionSteps: [
        "Snack on a handful of soaked almonds and walnuts instead of deep-fried namkeen or bakery items.",
        "Include 1 tablespoon of ground flaxseeds daily in your morning curd or oatmeal.",
        "Limit intake of full-fat dairy creams, palm oil, and processed hydrogenated fats.",
      ],
      disclaimer: GENERAL_DISCLAIMER,
    });
  }

  // Baseline age-tailored diet
  if (age >= 50) {
    recs.push({
      id: "diet-age-bone-density",
      category: "diet",
      title: "Calcium & Vitamin D-Rich Bone & Muscle Nutrition",
      advice:
        "Maintain adequate dietary calcium through fortified milk, paneer, sesame seeds (til), and dark leafy greens to support bone density and prevent age-associated muscle atrophy (sarcopenia).",
      whyRecommended: `Recommended for age ${age}. Calcium absorption and muscle protein synthesis naturally decline with age; adequate micronutrient intake protects bone mineral density and posture.`,
      evidenceTag: `Age ${age} Health Maintenance`,
      urgency: "preventive",
      actionSteps: [
        "Include a portion of protein (lentils, paneer, eggs, tofu) in every meal to preserve lean muscle mass.",
        "Get 15-20 minutes of mild early morning sunlight to support natural Vitamin D synthesis.",
      ],
      disclaimer: GENERAL_DISCLAIMER,
    });
  }

  // --- B. PHYSICAL ACTIVITY RECOMMENDATIONS ---
  if (isDiabetic || (latestHbA1c && latestHbA1c > 6.5)) {
    recs.push({
      id: "activity-post-meal-stroll",
      category: "activity",
      title: "Postprandial 10-Minute Gentle Walk",
      advice:
        "Take a brisk 10 to 15-minute gentle walk within 30 minutes following major meals (especially lunch and dinner).",
      whyRecommended: `Recommended because light contraction of large leg muscle groups activates non-insulin-mediated GLUT4 glucose transporters, clearing circulating glucose from your bloodstream directly after eating.`,
      evidenceTag: `Target: Post-Meal Glycemia Control`,
      urgency: "high",
      actionSteps: [
        "Avoid immediately lying down or sitting sedentary after dinner.",
        "Step outdoors or walk indoors at a relaxed, comfortable pace for 10-15 continuous minutes.",
      ],
      disclaimer: GENERAL_DISCLAIMER,
    });
  }

  if (age < 55) {
    recs.push({
      id: "activity-cardio-endurance",
      category: "activity",
      title: "150 Minutes/Week Moderate Aerobic Fitness",
      advice:
        "Engage in 30 minutes of moderate-intensity physical activity (such as brisk walking, cycling, or swimming) 5 days per week.",
      whyRecommended: `Tailored for age ${age} to promote cardiovascular endurance, maintain arterial elasticity, and optimize metabolic rate.`,
      evidenceTag: `Age ${age} Recommended Cardio Baseline`,
      urgency: "medium",
      actionSteps: [
        "Aim for a walking pace where you can talk comfortably but cannot sing without pausing for breath.",
        "Gradually build stamina by starting with 15 minutes twice daily if 30 minutes continuous feels strenuous.",
      ],
      disclaimer: GENERAL_DISCLAIMER,
    });
  } else {
    recs.push({
      id: "activity-low-impact-mobility",
      category: "activity",
      title: "Low-Impact Joint Mobility & Balance Routine",
      advice:
        "Focus on low-impact walking, gentle joint rotations, chair yoga, and balance exercises to support joint lubrication and stability without excessive orthopedic stress.",
      whyRecommended: `Tailored for your age profile (${age} yrs) to protect knee and hip cartilage while boosting functional balance and reducing accidental fall risk.`,
      evidenceTag: `Age ${age} Low-Impact Mobility`,
      urgency: "medium",
      actionSteps: [
        "Practice single-leg standing near a supportive wall or chair for 15 seconds per side.",
        "Choose supportive footwear with adequate arch cushioning for all daily walks.",
      ],
      disclaimer: GENERAL_DISCLAIMER,
    });
  }

  // --- C. SLEEP & CIRCADIAN HYGIENE ---
  recs.push({
    id: "sleep-circadian-rhythm",
    category: "sleep",
    title: "7–8 Hours Consistent Circadian Sleep Schedule",
    advice:
      "Maintain a uniform bedtime and wake-up time within a 30-minute window every day, even on weekends. Dim overhead lights 1 hour before sleep.",
    whyRecommended: `Vital for metabolic and neuroendocrine equilibrium. Irregular sleep patterns elevate evening cortisol and ghrelin, aggravating insulin resistance and night-time blood pressure elevation.`,
    evidenceTag: `Circadian Health & Cortisol Regulation`,
    urgency: "medium",
    actionSteps: [
      "Switch off blue-light emitting smartphones, tablets, and televisions at least 45 minutes prior to sleep.",
      "Keep the bedroom dark, quiet, and slightly cool (around 20-22°C) to facilitate deep REM rest.",
    ],
    disclaimer: GENERAL_DISCLAIMER,
  });

  // --- D. HABITS & MONITORING ---
  if (isHypertensive || isDiabetic) {
    recs.push({
      id: "habits-home-vitals-log",
      category: "habits",
      title: "Regular Home Vitals Self-Monitoring Habit",
      advice:
        "Establish a routine to record your resting morning blood pressure or fasting capillary glucose once or twice a week before breakfast.",
      whyRecommended: `Recommended because you have active metabolic or vascular health considerations. Regular home records empower your doctor to fine-tune therapeutic doses and spot trends early.`,
      evidenceTag: `Personalized Care Monitoring`,
      urgency: "high",
      actionSteps: [
        "Take readings after sitting resting quietly for 5 minutes without talking or cross-legged posture.",
        "Log your values into AyuvSaathi so your Unified Health Timeline remains up to date.",
      ],
      disclaimer: GENERAL_DISCLAIMER,
    });
  }

  recs.push({
    id: "habits-stress-diaphragmatic-breathing",
    category: "habits",
    title: "Daily 5-Minute Diaphragmatic Breathwork (Pranayama)",
    advice:
      "Practice 5 to 10 minutes of slow diaphragmatic belly breathing (such as 4-7-8 breathing or Anulom Vilom) once or twice daily.",
    whyRecommended: `Conscious slow respiration stimulates vagal nerve parasympathetic tone, reducing systemic sympathetic overdrive and lowering resting pulse rate.`,
    evidenceTag: `Autonomic Nervous System Wellness`,
    urgency: "preventive",
    actionSteps: [
      "Inhale deeply through your nose for 4 counts, expanding your diaphragm.",
      "Hold gently for 4 counts, and exhale completely through pursed lips for 6 counts.",
    ],
    disclaimer: GENERAL_DISCLAIMER,
  });

  const overallWellnessScore = Math.min(
    95,
    Math.max(65, 88 - (identifiedConditions.size * 6) + (observations.length > 0 ? 5 : 0))
  );

  const summary = `Based on your age (${age} years), ${
    identifiedConditions.size > 0
      ? `active health considerations (${Array.from(identifiedConditions).join(", ")})`
      : "profile health records"
  }, and verified biomarker metrics, we have formulated ${recs.length} personalized lifestyle and wellness suggestions.`;

  return {
    age,
    gender: user.gender,
    identifiedConditions: Array.from(identifiedConditions),
    keyBiomarkers,
    recommendations: recs,
    overallWellnessScore,
    summary,
  };
}
