/**
 * AyuvSaathi AI Clinical Guardrails
 * 
 * Enforces strict medical and health-only domain restrictions.
 * Rejects non-medical queries (coding, politics, general trivia, finance, entertainment, prompt injection)
 * while allowing queries about uploaded reports, prescriptions, symptoms, treatments, vitals, and wellness.
 */

export interface GuardrailResult {
  isMedical: boolean;
  category: "medical_records" | "clinical_query" | "wellness_health" | "general_greeting" | "non_medical_restricted";
  reason?: string;
  refusalMessage: string;
}

const MEDICAL_KEYWORDS = [
  // General medical & clinical
  "health", "medical", "medicine", "doctor", "physician", "hospital", "clinic", "nurse",
  "patient", "disease", "illness", "condition", "disorder", "syndrome", "symptom", "diagnosis",
  "prognosis", "treatment", "therapy", "surgery", "operation", "admitted", "discharge",
  "prescription", "prescribed", "dose", "dosage", "tablet", "capsule", "syrup", "injection",
  "ointment", "drops", "pills", "medication", "drug", "antibiotic", "painkiller", "steroid",
  "side effect", "adverse", "contraindication", "interaction",

  // Reports & lab diagnostics
  "report", "lab", "test", "result", "scan", "x-ray", "xray", "mri", "ct scan", "ultrasound",
  "ecg", "ekg", "eeg", "biopsy", "pathology", "culture", "cbc", "complete blood count",
  "hemoglobin", "hb", "wbc", "rbc", "platelet", "platelets", "glucose", "sugar", "fasting",
  "postprandial", "ppbs", "fbs", "hba1c", "cholesterol", "lipid", "triglycerides", "hdl", "ldl",
  "vldl", "creatinine", "urea", "bun", "uric acid", "bilirubin", "sgpt", "alt", "sgot", "ast",
  "alkaline phosphatase", "alp", "thyroid", "tsh", "t3", "t4", "vitamin d", "b12", "calcium",
  "potassium", "sodium", "electrolyte", "urine", "stool", "esr", "crp", "ferritin", "iron",
  "out of range", "normal range", "reference range", "high", "low", "elevated", "abnormal",

  // Diseases & Conditions
  "diabetes", "diabetic", "hypertension", "bp", "blood pressure", "hypotension", "asthma",
  "bronchitis", "pneumonia", "cough", "cold", "fever", "flu", "covid", "infection", "allergy",
  "allergic", "rash", "eczema", "dermatitis", "migraine", "headache", "arthritis", "osteoarthritis",
  "osteoporosis", "gastritis", "gerd", "acid reflux", "ulcer", "constipation", "diarrhea",
  "anemia", "jaundice", "hepatitis", "cirrhosis", "kidney stone", "renal", "dialysis", "uti",
  "cardiac", "heart attack", "stroke", "paralysis", "cancer", "tumor", "cyst", "thyroiditis",
  "hypothyroid", "hyperthyroid", "pcod", "pcos", "depression", "anxiety", "insomnia", "dementia",
  "alzheimer", "parkinson", "epilepsy", "seizure",

  // Symptoms & Physiology
  "pain", "ache", "swelling", "inflammation", "fatigue", "tired", "weakness", "dizziness",
  "vertigo", "nausea", "vomiting", "shortness of breath", "breathless", "wheezing", "chest pain",
  "palpitation", "numbness", "tingling", "cramp", "stiffness", "bleeding", "bruise", "itch",
  "chills", "sweating", "weight loss", "weight gain", "loss of appetite", "vital", "pulse",
  "heart rate", "oxygen", "spo2", "temperature",

  // Anatomy & Organs
  "heart", "lung", "lungs", "liver", "kidney", "kidneys", "brain", "stomach", "intestine",
  "gut", "colon", "pancreas", "spleen", "gallbladder", "bladder", "spine", "bone", "joint",
  "muscle", "artery", "vein", "blood", "skin", "eye", "ear", "nose", "throat", "chest",
  "abdomen", "back", "neck", "shoulder", "knee", "foot", "leg", "arm", "hand",

  // Wellness & Lifestyle
  "diet", "nutrition", "food", "calorie", "protein", "carbohydrate", "fat", "fiber", "water",
  "hydration", "sleep", "exercise", "workout", "physical activity", "walking", "yoga", "stress",
  "mental health", "lifestyle", "habit", "smoking", "alcohol", "bmi", "weight", "obesity",
  "immunity", "supplement", "vitamin", "mineral",

  // AyuvSaathi Records & Platform
  "uploaded", "my report", "my reports", "my prescription", "my medicine", "my records",
  "my doctor", "my visit", "my results", "ayuvsaathi", "timeline", "reminder", "dose",

  // Multilingual Medical Keywords (Telugu & Hindi)
  "హిమోగ్లోబిన్", "రక్తం", "చక్కెర", "షుగర్", "గ్లూకోజ్", "బీపీ", "గుండె", "మందు", "మందులు", "ఆరోగ్యం", "డాక్టర్", "ల్యాబ్", "రిపోర్ట్", "రిపోర్టు", "జ్వరం", "తలనొప్పి", "కడుపునొప్పి", "పరీక్ష", "విలువ",
  "हीमोग्लोबिन", "रक्त", "खून", "शुगर", "ग्लूकोज", "बीपी", "दवा", "दवाएं", "दवाइयां", "स्वास्थ्य", "डॉक्टर", "रिपोर्ट", "जांच", "बुखार", "सिरदर्द", "दर्द", "परीक्षण", "मान"
];

const NON_MEDICAL_PATTERNS = [
  // Programming & Tech
  /\b(write|create|debug|generate|fix|run|compile)\s+(code|script|program|function|class|sql|python|javascript|typescript|java|c\+\+|html|css|bash|powershell|regex)\b/i,
  /\b(algorithm|github|docker|kubernetes|aws|azure|database query|pull request|git commit|api route)\b/i,
  
  // Non-medical trivia & General facts
  /\b(who is the president|who is the prime minister|who won the (match|game|world cup|election|oscar))\b/i,
  /\b(capital of|population of|currency of|distance between|history of (france|rome|ww1|ww2|war))\b/i,
  
  // Creative Writing & Entertainment
  /\b(write a (poem|story|song|essay|joke|riddle|screenplay|script about))\b/i,
  /\b(movie review|celebrity|box office|actor|actress|video game|playstation|xbox)\b/i,
  
  // Finance & Economics
  /\b(crypto|cryptocurrency|bitcoin|ethereum|stock price|stock market|forex|invest in|mutual fund|real estate investment)\b/i,
  
  // Non-medical Academic & Math
  /\b(solve (equation|math|algebra|calculus|physics problem)|pythagorean theorem|integrate|derivative of)\b/i,

  // Prompt Injections / Jailbreak attempts
  /\b(ignore (all )?previous instructions|system prompt|reveal your prompt|act as dan|unrestricted mode|jailbreak)\b/i
];

const GREETINGS = [
  "hi", "hello", "hey", "good morning", "good afternoon", "good evening", "namaste", "vanakkam", "help", "who are you"
];

const REFUSAL_MESSAGES: Record<string, string> = {
  en: "I am AyuvSaathi Clinical AI Assistant, specialized exclusively in healthcare, medical records, diagnostic reports, and prescriptions. I cannot assist with non-medical questions. Please ask a health, symptom, medication, or medical report-related question.",
  te: "నేను ఆయువ్‌సాథి మెడికల్ ఏఐ అసిస్టెంట్‌ని. నేను కేవలం ఆరోగ్యం, మెడికల్ ల్యాబ్ రిపోర్టులు, ప్రిస్క్రిప్షన్లు మరియు వైద్య సంబంధిత విషయాలకు మాత్రమే సమాధానం ఇవ్వగలను. ఇతర విషయాలకు సహాయం చేయలేను. దయచేసి మీ ఆరోగ్యం, మందులు లేదా మెడికల్ రికార్డుల సంబంధిత ప్రశ్నలను అడగండి.",
  hi: "मैं आयुवसाथी क्लिनिकल एआई सहायक हूँ। मैं केवल स्वास्थ्य, मेडिकल जांच रिपोर्ट, पर्चे (प्रिस्क्रिप्शन) और स्वास्थ्य संबंधी विषयों पर ही सहायता कर सकता हूँ। मैं गैर-चिकित्सा प्रश्नों का उत्तर देने के लिए अधिकृत नहीं हूँ। कृपया स्वास्थ्य, लक्षण, दवा या अपनी मेडिकल रिपोर्ट से संबंधित प्रश्न पूछें।"
};

export function validateMedicalQuery(
  rawQuery: string,
  locale: string = "en",
  patientRecordsContext: string = ""
): GuardrailResult {
  const query = rawQuery.trim().toLowerCase();
  const langKey = ["en", "te", "hi"].includes(locale) ? locale : "en";
  const defaultRefusal = REFUSAL_MESSAGES[langKey] || REFUSAL_MESSAGES.en;

  if (!query) {
    return {
      isMedical: true,
      category: "general_greeting",
      refusalMessage: defaultRefusal,
    };
  }

  // 1. Check for prompt injection or explicit non-medical patterns
  for (const pattern of NON_MEDICAL_PATTERNS) {
    if (pattern.test(query)) {
      return {
        isMedical: false,
        category: "non_medical_restricted",
        reason: "Detected explicit non-medical or restricted topic.",
        refusalMessage: defaultRefusal,
      };
    }
  }

  // 2. Allow short general greetings & identity queries
  if (query.length <= 25 && GREETINGS.some((g) => query === g || query.startsWith(g))) {
    return {
      isMedical: true,
      category: "general_greeting",
      refusalMessage: defaultRefusal,
    };
  }

  // 3. Check for references to patient records
  const isReferencingRecords =
    query.includes("report") ||
    query.includes("prescription") ||
    query.includes("medicine") ||
    query.includes("doctor") ||
    query.includes("result") ||
    query.includes("upload") ||
    query.includes("test") ||
    query.includes("summary") ||
    query.includes("record");

  if (isReferencingRecords) {
    return {
      isMedical: true,
      category: "medical_records",
      refusalMessage: defaultRefusal,
    };
  }

  // 4. Tokenize and check match against clinical vocabulary
  const tokens = query.split(/[\s,?.!;:"'()\[\]{}]+/).filter((t) => t.length > 2);
  let medicalScore = 0;

  for (const keyword of MEDICAL_KEYWORDS) {
    if (query.includes(keyword)) {
      medicalScore += 2;
    }
  }

  for (const token of tokens) {
    if (MEDICAL_KEYWORDS.includes(token)) {
      medicalScore += 1;
    }
  }

  // Also check if any unique term from patient's uploaded records is mentioned
  if (patientRecordsContext && patientRecordsContext.length > 10) {
    const contextLower = patientRecordsContext.toLowerCase();
    for (const token of tokens) {
      if (token.length > 3 && contextLower.includes(token)) {
        medicalScore += 2;
      }
    }
  }

  if (medicalScore >= 2) {
    return {
      isMedical: true,
      category: "clinical_query",
      refusalMessage: defaultRefusal,
    };
  }

  // If query does not contain medical terms and doesn't reference health records
  return {
    isMedical: false,
    category: "non_medical_restricted",
    reason: "Query does not relate to medical, health, or clinical records.",
    refusalMessage: defaultRefusal,
  };
}
