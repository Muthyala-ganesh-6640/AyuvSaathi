/**
 * AyuvSaathi AI Clinical Guardrails
 * 
 * Enforces strict medical and health-only domain restrictions:
 * Responds ONLY to medical related issues along with prescriptions, medical records, and diagnostic reports.
 * Restricts all non-medical data and non-medical queries (coding, politics, general trivia, finance, entertainment, prompt injection)
 * while ensuring valid clinical questions, prescriptions, patient health records, and reports (in English, Telugu, and Hindi)
 * are accurately recognized and answered without interrupting any API calls.
 */

export interface GuardrailResult {
  isMedical: boolean;
  category: "medical_records" | "clinical_query" | "wellness_health" | "general_greeting" | "non_medical_restricted";
  reason?: string;
  refusalMessage: string;
}

// Explicit non-medical patterns and deceptive false-positive phrases
const NON_MEDICAL_PATTERNS = [
  // Programming & Software Development
  /\b(write|create|debug|generate|fix|run|compile)\s+(a\s+|an\s+|some\s+|me\s+)?(code|script|program|function|class|sql|python|javascript|typescript|java|c\+\+|html|css|bash|powershell|regex)\b/i,
  /\b(python|javascript|typescript|java|c\+\+|golang|rust|html|css|sql|bash|powershell)\s+(code|script|program|function|app)\b/i,
  /\b(code|script)\s+to\s+(scrape|parse|build|fetch|hack|crawl)\b/i,
  /\b(algorithm|github|docker|kubernetes|aws|azure|database query|pull request|git commit|api route|unit test)\b/i,
  
  // Non-medical Trivia & General World Facts
  /\b(who is the president|who is the prime minister|who won the (match|game|world cup|election|oscar|ipl))\b/i,
  /\b(capital of|population of|currency of|distance between|history of (france|rome|ww1|ww2|war|india|china))\b/i,
  
  // Creative Writing & Entertainment
  /\b(write a (poem|story|song|essay|joke|riddle|screenplay|script about))\b/i,
  /\b(movie review|celebrity|box office|actor|actress|video game|playstation|xbox|netflix)\b/i,
  /\b(doctor who|doctor strange|witch doctor)\b/i,
  /\b(movie summary|book summary|plot summary|film summary|episode summary)\b/i,
  
  // Non-medical "record", "test", "result", "upload" idioms
  /\b(world record|record a song|record a video|record an album|broken the record|olympic record|guinness record)\b/i,
  /\b(speed test|driving test|iq test|math test|personality test|internet test)\b/i,
  /\b(election results?|match results?|exam results?|lottery results?|game results?|cricket score)\b/i,
  /\b(upload (a |to )?(video|song|youtube|facebook|instagram|tiktok|drive|cloud))\b/i,

  // Finance, Stocks & Crypto
  /\b(crypto|cryptocurrency|bitcoin|ethereum|stock price|stock market|forex|invest in|mutual fund|real estate investment)\b/i,
  
  // Non-medical Math & Physics
  /\b(solve (equation|math|algebra|calculus|physics problem)|pythagorean theorem|integrate|derivative of)\b/i,

  // Prompt Injections / Jailbreak attempts
  /\b(ignore (all )?previous instructions|system prompt|reveal your prompt|act as dan|unrestricted mode|jailbreak)\b/i
];

// Explicit medical records, prescriptions, and diagnostic reports phrases
const MEDICAL_RECORDS_PHRASES = [
  // Prescriptions & Medications
  /\b(prescriptions?|prescribed|rx|medicines?|medications?|dosage|doses?|tablets?|capsules?|syrups?|injections?)\b/i,
  /\b(medication schedule|medicine timing|pill reminder|daily dose)\b/i,
  
  // Reports & Lab Diagnostics
  /\b(medical reports?|lab reports?|diagnostic reports?|pathology reports?|blood reports?|test reports?)\b/i,
  /\b(lab results?|blood test results?|test results?|diagnostic results?|test values?|biomarker results?)\b/i,
  /\b(my reports?|my lab|uploaded reports?|uploaded documents?|my test results?)\b/i,
  /\b(reference ranges?|normal ranges?|out of range|abnormal values?)\b/i,

  // Medical Records & Clinical Consultations
  /\b(medical records?|health records?|patient records?|clinical records?|my records?)\b/i,
  /\b(doctor visits?|doctor consultation|doctor summary|discharge summary|doctor notes?|clinical summary)\b/i,
  /\b(doctor advice|clinical findings?|hospital records?|clinical history)\b/i,
];

// Indic Multilingual Medical, Prescription, Record, and Report Keywords
const INDIC_MEDICAL_KEYWORDS = [
  // Telugu (తెలుగు) - Reports, Prescriptions, Records, Health
  "ప్రిస్క్రిప్షన్", "ప్రిస్క్రిప్షన్లు", "మందుల చీటి", "మందులు", "మందు", "మాత్రలు",
  "రిపోర్ట్", "రిపోర్టు", "రిపోర్టులు", "ల్యాబ్ రిపోర్టు", "రక్త పరీక్ష", "పరీక్ష ఫలితాలు", "పరీక్ష",
  "రికార్డు", "రికార్డులు", "వైద్య రికార్డులు", "ఆరోగ్య రికార్డులు", "డిశ్చార్జ్ సమ్మరీ",
  "వైద్యుల సలహా", "డాక్టర్ సలహా", "డాక్టర్", "ఆరోగ్యం", "గుండె", "రక్తం", "చక్కెర",
  "షుగర్", "గ్లూకోజ్", "బీపీ", "హిమోగ్లోబిన్", "జ్వరం", "తలనొప్పి", "కడుపునొప్పి", "విలువ",

  // Hindi (हिन्दी) - Reports, Prescriptions, Records, Health
  "पर्चा", "प्रिस्क्रिप्शन", "दवा", "दवाएं", "दवाइयां", "गोली", "खुराक",
  "रिपोर्ट", "जांच रिपोर्ट", "लैब रिपोर्ट", "मेडिकल रिपोर्ट", "रक्त जांच", "परीक्षण", "नतीजे", "परिणाम",
  "रिकॉर्ड", "रिकॉर्ड्स", "स्वास्थ्य रिकॉर्ड", "मेडिकल रिकॉर्ड", "डिस्चार्ज समरी",
  "डॉक्टर की सलाह", "डॉक्टर", "स्वास्थ्य", "दिल", "खून", "रक्त", "शुगर",
  "ग्लूकोज", "बीपी", "हीमोग्लोबिन", "बुखार", "सिरदर्द", "दर्द", "जांच", "मान"
];

// General medical vocabulary
const MEDICAL_KEYWORDS = [
  // General clinical & practice
  "health", "medical", "medicine", "doctor", "physician", "hospital", "clinic", "nurse",
  "patient", "disease", "illness", "condition", "disorder", "syndrome", "symptom", "diagnosis",
  "prognosis", "treatment", "therapy", "surgery", "operation", "admitted", "discharge",
  "prescription", "prescribed", "dose", "dosage", "tablet", "capsule", "syrup", "injection",
  "ointment", "drops", "pills", "medication", "drug", "antibiotic", "painkiller", "steroid",
  "side effect", "adverse", "contraindication", "interaction",

  // Diagnostic tests & biomarkers
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

  // Patient records & platform
  "uploaded", "my report", "my reports", "my prescription", "my medicine", "my records",
  "my doctor", "my visit", "my results", "ayuvsaathi", "timeline", "reminder", "dose",
  "discharge summary", "doctor summary", "consultation",

  // Include Indic keywords in the general keyword set
  ...INDIC_MEDICAL_KEYWORDS
];

const COMMON_NON_CLINICAL_TOKENS = new Set([
  "data", "from", "with", "this", "that", "have", "make", "what", "when", "where",
  "your", "name", "file", "page", "user", "type", "date", "time", "text", "show",
  "tell", "give", "help", "good", "some", "more", "like", "want", "need", "about",
  "write", "code", "script", "scrape", "websites", "python", "javascript"
]);

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

  // 1. Check for prompt injection or explicit non-medical patterns first
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

  // 3. Check for explicit references to patient records, prescriptions, and reports
  for (const phraseRegex of MEDICAL_RECORDS_PHRASES) {
    if (phraseRegex.test(query)) {
      return {
        isMedical: true,
        category: "medical_records",
        refusalMessage: defaultRefusal,
      };
    }
  }

  // Check Indic references to records, prescriptions, and reports
  const hasIndicRecordTerm = INDIC_MEDICAL_KEYWORDS.some((kw) => query.includes(kw.toLowerCase()));
  if (hasIndicRecordTerm) {
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
    if (query.includes(keyword.toLowerCase())) {
      medicalScore += 2;
    }
  }

  for (const token of tokens) {
    if (MEDICAL_KEYWORDS.some((k) => k.toLowerCase() === token)) {
      medicalScore += 1;
    }
  }

  // Also check if any clinical term from patient's uploaded records is mentioned
  if (patientRecordsContext && patientRecordsContext.length > 5) {
    const contextLower = patientRecordsContext.toLowerCase();
    for (const token of tokens) {
      if (token.length > 3 && !COMMON_NON_CLINICAL_TOKENS.has(token) && contextLower.includes(token)) {
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

  // If query does not contain medical terms and doesn't reference health records/prescriptions/reports
  return {
    isMedical: false,
    category: "non_medical_restricted",
    reason: "Query does not relate to medical, health, prescription, or clinical records.",
    refusalMessage: defaultRefusal,
  };
}
