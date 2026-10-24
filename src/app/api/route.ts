import { serviceStatus } from "@/lib/env";
import { nowIso } from "@/lib/utils";

export async function GET() {
  const services = serviceStatus();

  return Response.json({
    status: "healthy",
    app: "AyuvSaathi",
    tagline: "Your Lifelong Health Companion",
    version: "1.0.0",
    root: "/api",
    health: "/api/health",
    timestamp: nowIso(),
    services,
    endpoints: {
      auth: {
        signIn: "/api/auth/sign-in",
        signUp: "/api/auth/sign-up",
        signOut: "/api/auth/sign-out",
        me: "/api/auth/me",
        reset: "/api/auth/reset",
        switchRole: "/api/auth/switch-role",
      },
      patient: {
        dashboard: "/api/dashboard",
        documents: "/api/documents",
        prescriptions: "/api/prescriptions",
        medications: "/api/medications",
        timeline: "/api/timeline",
        appointments: "/api/appointments",
        observations: "/api/observations",
        wellness: "/api/wellness/recommendations",
      },
      assistant: {
        chat: "/api/assistant/chat",
        conversations: "/api/assistant/conversations",
        transcribe: "/api/audio/transcribe",
      },
      care: {
        nearby: "/api/care/nearby",
        geocode: "/api/care/geocode",
      },
      ecosystem: {
        connections: "/api/connections",
        family: "/api/family",
        notifications: "/api/notifications",
        qrToken: "/api/qr/token",
        qrResolve: "/api/qr/resolve",
      },
    },
  });
}
