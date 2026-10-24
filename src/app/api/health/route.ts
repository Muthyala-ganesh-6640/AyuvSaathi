import { serviceStatus } from "@/lib/env";
import { nowIso } from "@/lib/utils";

export async function GET() {
  const services = serviceStatus();

  let backendHealth: { status: string; url?: string; detail?: string } = {
    status: "not_configured",
  };

  const backendUrl = process.env.BACKEND_URL;
  if (backendUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${backendUrl}/api/health`, {
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        backendHealth = {
          status: "healthy",
          url: backendUrl,
          detail: data?.database ? `database: ${data.database}` : "connected",
        };
      } else {
        backendHealth = {
          status: "degraded",
          url: backendUrl,
          detail: res ? `HTTP ${res.status}` : "unreachable",
        };
      }
    } catch {
      backendHealth = {
        status: "unreachable",
        url: backendUrl,
      };
    }
  }

  return Response.json({
    status: "healthy",
    app: "AyuvSaathi",
    tagline: "Your Lifelong Health Companion",
    version: "1.0.0",
    timestamp: nowIso(),
    services,
    backend: backendHealth,
    modules: [
      "Authentication & Session Management",
      "Medical Document OCR & Vision Extraction",
      "Lab Observation Reference Analysis",
      "Prescription & Medication Schedule Tracking",
      "Grounded AI Health Consultation Assistant",
      "Unified Chronological Patient Timeline",
      "Doctor Visit Preparation & Summaries",
      "Nearby Healthcare Facility Discovery",
      "Personalized Wellness Recommendations",
    ],
  });
}
