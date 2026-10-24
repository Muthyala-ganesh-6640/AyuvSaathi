import { serviceStatus } from "@/lib/env";
import { nowIso } from "@/lib/utils";

export async function GET() {
  const services = serviceStatus();

  return Response.json({
    status: "healthy",
    app: "AyuvSaathi",
    tagline: "Your Lifelong Health Companion",
    version: "1.0.0",
    timestamp: nowIso(),
    services,
    modules: [
      "Authentication & Session Management",
      "Medical Document OCR & Vision Extraction",
      "Lab Observation Reference Analysis",
      "Prescription & Medication Schedule Tracking",
      "Grounded AI Health Consultation Assistant",
      "Unified Chronological Patient Timeline",
      "Doctor Visit Preparation & Summaries",
      "Nearby Healthcare Facility Discovery",
    ],
  });
}
