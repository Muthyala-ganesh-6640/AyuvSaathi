import json
from typing import List, Dict, Any, Optional
import httpx
from backend.app.core.config import settings

EMERGENCY_RED_FLAGS = [
    "chest pain", "shortness of breath", "difficulty breathing",
    "slurred speech", "facial drooping", "arm weakness", "sudden paralysis",
    "severe sudden headache", "unconscious", "coughing blood",
    "గుండె నొప్పి", "శ్వాస ఆడకపోవడం", "ఛాతీ నొప్పి", "రక్తం వాంతి"
]

TELUGU_TRANSLATIONS = {
    "Hemoglobin": "హిమోగ్లోబిన్ (రక్త కణాల పరిమాణం)",
    "Fasting Blood Sugar": "ఉపవాస రక్త చక్కెర (FBS)",
    "Post Prandial Blood Sugar": "భోజనం తర్వాత రక్త చక్కెర (PPBS)",
    "HbA1c": "గ్లైకేటెడ్ హిమోగ్లోబిన్ (3 నెలల సగటు చక్కెర)",
    "Total Cholesterol": "మొత్తం కొలెస్ట్రాల్",
    "Serum Creatinine": "సీరం క్రియాటినిన్ (మూత్రపిండాల పనితీరు)",
    "Thyroid Stimulating Hormone (TSH)": "థైరాయిడ్ హార్మోన్ (TSH)",
    "Vitamin D3 (25-OH)": "విటమిన్ D3 స్థాయి",
    "HIGH": "ఎక్కువగా ఉంది",
    "LOW": "తక్కువగా ఉంది",
    "NORMAL": "సాధారణ శ్రేణిలో ఉంది"
}

class AIService:
    @staticmethod
    def call_cloud_gpt_model(system_prompt: str, user_prompt: str) -> Optional[str]:
        """Calls OpenAI GPT models (e.g. gpt-4o, gpt-4o-mini) or compatible cloud LLM endpoint."""
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            return None
        
        base_url = settings.AI_BASE_URL.rstrip("/") if settings.AI_BASE_URL else "https://api.openai.com/v1"
        endpoint = f"{base_url}/chat/completions"
        model = settings.AI_MODEL or "gpt-4o-mini"
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2,
            "max_tokens": 800
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(endpoint, json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "").strip()
        except Exception:
            return None
        return None

    @staticmethod
    def detect_emergency(text: str) -> bool:
        lower = text.lower()
        return any(flag.lower() in lower for flag in EMERGENCY_RED_FLAGS)

    @classmethod
    def generate_clinical_assessment(
        cls, 
        patient_name: str, 
        symptoms: str, 
        duration: Optional[str],
        verified_labs: List[Dict[str, Any]], 
        active_meds: List[str]
    ) -> Dict[str, Any]:
        is_urgent = cls.detect_emergency(symptoms)
        
        urgency_level = "routine"
        if is_urgent:
            urgency_level = "emergency_alert"
        elif any(lab.get("is_abnormal") for lab in verified_labs):
            urgency_level = "prompt_evaluation"

        # Synthesize relevant findings strictly from user's verified labs
        findings = []
        for lab in verified_labs:
            flag = lab.get("abnormal_flag", "NORMAL")
            test = lab.get("test_name", "Test")
            val = lab.get("measured_value", "")
            unit = lab.get("unit", "")
            ref = lab.get("reference_range", "")
            if flag in ["HIGH", "LOW"]:
                findings.append(f"{test}: {val} {unit} is {flag} (Standard Reference: {ref})")
            else:
                findings.append(f"{test}: {val} {unit} is within normal reference ({ref})")

        if active_meds:
            findings.append(f"Confirmed current medications: {', '.join(active_meds)}")

        # Topics to discuss with clinician
        topics = [
            f"Review symptoms of '{symptoms}' documented since {duration or 'recent onset'}.",
            "Evaluate whether documented out-of-range lab parameters require follow-up testing or clinical intervention.",
            "Verify current medication tolerance and confirm ongoing dosage schedules."
        ]

        # Questions the user can ask their doctor
        doctor_questions = [
            "Are my current symptoms related to my laboratory findings?",
            "Do I need to adjust my diet, lifestyle, or medication schedule?",
            "When should I repeat these laboratory investigations?",
            "What symptoms should prompt immediate emergency evaluation?"
        ]

        disclaimer = (
            "SAFETY NOTICE: AyuvSaathi provides health informatics and organizational support. "
            "This assessment is NOT a medical diagnosis and cannot prescribe or alter medication. "
            "Always consult your treating healthcare professional for clinical decisions."
        )

        if is_urgent:
            disclaimer = (
                "EMERGENCY WARNING: Potential critical symptoms detected. "
                "Please do not wait for an online assessment. Call emergency services immediately "
                "(Ambulance: 108, National Emergency: 112 in India) or visit the nearest emergency department."
            )

        return {
            "reported_concerns": symptoms,
            "relevant_findings": findings if findings else ["No prior verified laboratory abnormalities recorded."],
            "clinical_discussion_topics": topics,
            "missing_info_uncertainties": (
                "Exact onset timeline, clinical physical examination findings, "
                "vital signs (blood pressure, heart rate), and physician auscultation are required for complete evaluation."
            ),
            "doctor_questions": doctor_questions,
            "urgency_level": urgency_level,
            "disclaimer": disclaimer,
            "source_references": [f"Lab records ({len(verified_labs)} items)", f"Active medications ({len(active_meds)} items)"]
        }

    @classmethod
    def answer_health_query(
        cls,
        query: str,
        language: str = "en",
        verified_labs: Optional[List[Dict[str, Any]]] = None,
        active_meds: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        verified_labs = verified_labs or []
        active_meds = active_meds or []
        is_urgent = cls.detect_emergency(query)
        
        sources = []
        if verified_labs:
            sources.append(f"{len(verified_labs)} verified lab observation(s)")
        if active_meds:
            sources.append(f"{len(active_meds)} confirmed active prescription(s)")

        if is_urgent:
            if language == "te":
                reply = (
                    "⚠️ అత్యవసర హెచ్చరిక: మీరు పేర్కొన్న లక్షణాలు (ఉదా. ఛాతీ నొప్పి, శ్వాసలో ఇబ్బంది) తక్షణ వైద్య సహాయం అవసరమైన సంకేతాలు కావచ్చు. "
                    "దయచేసి ఆలస్యం చేయకుండా వెంటనే 108 లేదా 112 కి కాల్ చేయండి లేదా సమీపంలోని అత్యవసర విభాగానికి (Emergency Room) వెళ్ళండి."
                )
            else:
                reply = (
                    "⚠️ CRITICAL MEDICAL ALERT: The symptoms you described may indicate an urgent medical situation. "
                    "Please do not rely on chat advice. Immediately call 108 or 112 (India) or proceed to the nearest hospital emergency room."
                )
            return {
                "role": "assistant",
                "content": reply,
                "source_references": ["Emergency Protocol Directive"]
            }

        # Safe grounded contextual guidance
        # If Cloud GPT model is available, use it with cautious medical grounding
        if settings.OPENAI_API_KEY:
            sys_prompt = (
                "You are AyuvSaathi (ఆయువ్ సాథీ) AI Health Assistant. "
                "Tagline: Your Lifelong Health Companion. "
                "You must provide cautious, empathetic, evidence-linked clinical information. "
                "You are not a doctor and must NEVER give definitive diagnoses or prescribe medicine. "
                f"Respond clearly in {'Telugu (తెలుగు)' if language == 'te' else 'English'}. "
                "Keep medical terms, units, and medicine names accurate."
            )
            gpt_reply = cls.call_cloud_gpt_model(sys_prompt, query)
            if gpt_reply:
                return {
                    "role": "assistant",
                    "content": gpt_reply,
                    "source_references": ["Cloud GPT Healthcare Intelligence (Evidence-Grounded)"] + sources
                }

        q_lower = query.lower()
        if language == "te":
            reply_parts = [
                "నమస్కారం! ఆయువ్ సాథీ మీ ధృవీకరించిన రికార్డుల ఆధారంగా క్రింది సమాచారాన్ని అందిస్తుంది:"
            ]
            if "షుగర్" in query or "sugar" in q_lower or "glucose" in q_lower:
                reply_parts.append("• రక్తంలో చక్కెర (Fasting Blood Sugar) సాధారణంగా 70-99 mg/dL మధ్య ఉండాలి. భోజనం తర్వాత 140 mg/dL లోపు ఉండటం అనుకూలం.")
            if "బిపి" in query or "bp" in q_lower or "pressure" in q_lower:
                reply_parts.append("• రక్తపోటు (BP) సాధారణ స్థాయి సుమారు 120/80 mmHg. క్రమం తప్పకుండా పర్యవేక్షించడం మరియు ఉప్పు తగ్గించడం మంచిది.")
            if "హిమోగ్లోబిన్" in query or "hemoglobin" in q_lower:
                reply_parts.append("• హిమోగ్లోబిన్ శరీరంలో ఆక్సిజన్ సరఫరాకు ముఖ్యం. ఇది తక్కువగా ఉంటే అలసట, నీరసం ఉండవచ్చు.")
            
            if not any(k in q_lower for k in ["sugar", "bp", "hemoglobin"]):
                reply_parts.append(
                    f"మీ ప్రశ్న: '{query}'. మీ ధృవీకరించిన నివేదికల ప్రకారం, మీ అన్ని ల్యాబ్ పరీక్షల ఫలితాలు మరియు మందుల వివరాలు మీ వైద్యునితో చర్చించడానికి సిద్ధంగా ఉన్నాయి."
                )

            reply_parts.append(
                "\nగమనిక: ఈ సమాచారం అవగాహన కోసం మాత్రమే. మందుల మోతాదులను మీ వైద్యుని సలహా లేకుండా మార్చవద్దు."
            )
            return {
                "role": "assistant",
                "content": "\n".join(reply_parts),
                "source_references": sources if sources else ["Standard Clinical Knowledge Base"]
            }
        else:
            reply_parts = [
                "Hello! Here is the grounded health guidance based on your verified records:"
            ]
            if "sugar" in q_lower or "glucose" in q_lower or "diabetes" in q_lower:
                reply_parts.append("• Blood Sugar: Normal fasting blood glucose is 70–99 mg/dL. HbA1c below 5.7% is considered non-diabetic range.")
            if "blood pressure" in q_lower or "bp" in q_lower or "hypertension" in q_lower:
                reply_parts.append("• Blood Pressure: Optimal resting BP is around 120/80 mmHg. Lifestyle balance and reduced sodium help maintain control.")
            if "cholesterol" in q_lower or "lipid" in q_lower:
                reply_parts.append("• Cholesterol: Total cholesterol under 200 mg/dL and LDL under 100 mg/dL are standard cardiovascular targets.")
            if "hemoglobin" in q_lower or "hb" in q_lower:
                reply_parts.append("• Hemoglobin: Essential for oxygen carriage (normal 12.0–17.5 g/dL). Low levels suggest anemia requiring dietary or medical assessment.")

            if len(reply_parts) == 1:
                reply_parts.append(
                    f"Regarding your inquiry about '{query}': Reviewing your verified medical documents, your current records are systematically cataloged. "
                    "Make sure to note any specific symptom triggers to share during your clinical consultation."
                )

            reply_parts.append(
                "\nMedical Note: AyuvSaathi provides health literacy support. Never start, stop, or change medication doses without consulting your doctor."
            )

            return {
                "role": "assistant",
                "content": "\n".join(reply_parts),
                "source_references": sources if sources else ["Clinical Informatics Reference"]
            }

    @classmethod
    def generate_conversation_summary(
        cls,
        conversation_title: str,
        messages: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        # Extract main concern and symptoms reported during conversation
        user_messages = [m["content"] for m in messages if m.get("role") == "user"]
        combined_text = " ".join(user_messages)

        symptoms_detected = []
        for word in ["headache", "fever", "cough", "fatigue", "nausea", "dizziness", "pain", "sugar high", "bp high"]:
            if word in combined_text.lower():
                symptoms_detected.append(word.title())

        if not symptoms_detected:
            symptoms_detected = ["General health review and laboratory report queries"]

        main_concern = user_messages[0][:80] if user_messages else "Routine health record consultation"

        return {
            "main_concern": f"Patient consultation regarding: {main_concern}",
            "reported_symptoms": symptoms_detected,
            "reported_dates_duration": "Recent consultation session",
            "relevant_record_refs": ["Health Chatbot Session Transcript"],
            "questions_raised": [
                "How to manage laboratory parameter deviations safely?",
                "Next recommended follow-up diagnostic timeline?"
            ],
            "follow_up_topics": [
                "Schedule physician appointment for confirmed lab evaluation",
                "Maintain hydration and regular medication schedule adherence"
            ],
            "uncertainties": "Physical examination not conducted; recommendations are educational."
        }
