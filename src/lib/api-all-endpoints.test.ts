import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

// Import all API routes
import { GET as healthCheck } from "@/app/api/health/route";
import { POST as signUp } from "@/app/api/auth/sign-up/route";
import { POST as signIn } from "@/app/api/auth/sign-in/route";
import { POST as signOut } from "@/app/api/auth/sign-out/route";
import { GET as getMe, PATCH as patchMe } from "@/app/api/me/route";
import { POST as seedDemo } from "@/app/api/demo/seed/route";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { GET as getDocuments, POST as postDocuments } from "@/app/api/documents/route";
import {
  GET as getDocumentById,
  PATCH as patchDocumentById,
  DELETE as deleteDocumentById,
} from "@/app/api/documents/[id]/route";
import {
  GET as getObservations,
  POST as postObservations,
} from "@/app/api/observations/route";
import { GET as getMultiReportAnalytics } from "@/app/api/analytics/multi-report/route";
import {
  GET as getObservationById,
  PATCH as patchObservationById,
  DELETE as deleteObservationById,
} from "@/app/api/observations/[id]/route";
import {
  GET as getMedications,
  POST as postMedications,
} from "@/app/api/medications/route";
import {
  GET as getMedicationById,
  PATCH as patchMedicationById,
  DELETE as deleteMedicationById,
} from "@/app/api/medications/[id]/route";
import { POST as postMedicationSchedule } from "@/app/api/medications/[id]/schedule/route";
import {
  GET as getAppointments,
  POST as postAppointments,
} from "@/app/api/appointments/route";
import {
  PATCH as patchAppointmentById,
  DELETE as deleteAppointmentById,
} from "@/app/api/appointments/[id]/route";
import { GET as getVisits, POST as postVisits } from "@/app/api/visits/route";
import {
  GET as getVisitById,
  PATCH as patchVisitById,
  DELETE as deleteVisitById,
} from "@/app/api/visits/[id]/route";
import { GET as getTimeline, POST as postTimeline } from "@/app/api/timeline/route";
import {
  GET as getTimelineById,
  DELETE as deleteTimelineById,
} from "@/app/api/timeline/[id]/route";
import {
  GET as getConversations,
  POST as postConversations,
} from "@/app/api/assistant/conversations/route";
import { GET as getConversationMessages } from "@/app/api/assistant/conversations/[id]/messages/route";
import { POST as assistantChat } from "@/app/api/assistant/chat/route";
import { GET as getNearbyCare } from "@/app/api/care/nearby/route";

describe("Exhaustive API Route Audit & Validation", () => {
  const testEmail = `audit_${Date.now()}@ayuvsaathi.in`;
  const testPassword = "AuditPassword123!";
  let sessionCookie = "";
  let createdDocId = "";
  let createdObsId = "";
  let createdMedId = "";
  let createdApptId = "";
  let createdVisitId = "";
  let createdTimelineId = "";
  let createdConvId = "";

  function req(
    url: string,
    method: string,
    options?: {
      body?: Record<string, unknown> | FormData;
      cookie?: string;
    }
  ) {
    const headers = new Headers({ host: "localhost:3000" });
    if (options?.cookie) headers.set("cookie", options.cookie);

    let bodyPayload: BodyInit | undefined;
    if (options?.body instanceof FormData) {
      bodyPayload = options.body;
    } else if (options?.body) {
      headers.set("content-type", "application/json");
      bodyPayload = JSON.stringify(options.body);
    }

    return new NextRequest(`http://localhost:3000${url}`, {
      method,
      headers,
      body: bodyPayload,
    });
  }

  // 1. Root Health
  it("GET /api/health: returns healthy status and active clinical modules", async () => {
    const res = await healthCheck();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("healthy");
    expect(data.app).toBe("AyuvSaathi");
    expect(Array.isArray(data.modules)).toBe(true);
  });

  // 2. Auth Flow: Sign-up
  it("POST /api/auth/sign-up: registers a new patient profile", async () => {
    const res = await signUp(
      req("/api/auth/sign-up", "POST", {
        body: {
          email: testEmail,
          password: testPassword,
          displayName: "Audit Patient",
          interfaceLanguage: "en",
        },
      })
    );
    const data = await res.json();
    if (res.status !== 200) console.error("Sign-up failed with:", data);
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);

    const cookie = res.headers.get("set-cookie");
    expect(cookie).toBeTruthy();
    if (cookie) sessionCookie = cookie.split(";")[0];
  });

  // 3. Auth Flow: Sign-in
  it("POST /api/auth/sign-in: logs in and returns session cookie", async () => {
    const res = await signIn(
      req("/api/auth/sign-in", "POST", {
        body: {
          email: testEmail,
          password: testPassword,
        },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  // 4. Me Endpoint (GET & PATCH)
  it("GET /api/me: returns authenticated user profile", async () => {
    const res = await getMe(req("/api/me", "GET", { cookie: sessionCookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.email).toBe(testEmail.toLowerCase());
  });

  it("PATCH /api/me: updates user settings and refreshes session cookie", async () => {
    const res = await patchMe(
      req("/api/me", "PATCH", {
        cookie: sessionCookie,
        body: { displayName: "Audit Patient Updated", timezone: "Asia/Kolkata" },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.displayName).toBe("Audit Patient Updated");
  });

  // 5. Demo Data Seed
  it("POST /api/demo/seed: populates synthetic records for user", async () => {
    const res = await seedDemo(req("/api/demo/seed", "POST", { cookie: sessionCookie, body: {} }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  // 6. Dashboard
  it("GET /api/dashboard: returns complete health dashboard overview", async () => {
    const res = await getDashboard(req("/api/dashboard", "GET", { cookie: sessionCookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stats).toBeDefined();
    expect(Array.isArray(data.medicines)).toBe(true);
  });

  // 7. Documents (GET, POST, PATCH, DELETE)
  it("GET /api/documents: returns document list", async () => {
    const res = await getDocuments(req("/api/documents", "GET", { cookie: sessionCookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.documents)).toBe(true);
  });

  it("POST /api/documents: handles file upload", async () => {
    const form = new FormData();
    const blob = new Blob(["%PDF-1.4 Mock Lab Document Content"], { type: "application/pdf" });
    form.append("file", blob, "sample-report.pdf");
    form.append("category", "lab_report");

    const res = await postDocuments(req("/api/documents", "POST", { cookie: sessionCookie, body: form }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.document.id).toBeDefined();
    createdDocId = data.document.id;
  });

  it("GET /api/documents/[id]: retrieves specific document and extractions", async () => {
    const res = await getDocumentById(
      req(`/api/documents/${createdDocId}`, "GET", { cookie: sessionCookie }),
      { params: Promise.resolve({ id: createdDocId }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.document.id).toBe(createdDocId);
  });

  it("PATCH /api/documents/[id]: updates document metadata", async () => {
    const res = await patchDocumentById(
      req(`/api/documents/${createdDocId}`, "PATCH", {
        cookie: sessionCookie,
        body: { displayName: "Renamed Clinical Report" },
      }),
      { params: Promise.resolve({ id: createdDocId }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.document.displayName).toBe("Renamed Clinical Report");
  });

  // 8. Observations (GET, POST, PATCH, DELETE)
  it("POST /api/observations: creates confirmed lab observation", async () => {
    const res = await postObservations(
      req("/api/observations", "POST", {
        cookie: sessionCookie,
        body: {
          documentId: createdDocId,
          name: "Platelet Count",
          value: "250",
          unit: "10^3/uL",
          referenceRange: "150 - 450 10^3/uL",
        },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.observation.id).toBeDefined();
    createdObsId = data.observation.id;
  });

  it("GET /api/observations: lists user observations", async () => {
    const res = await getObservations(req("/api/observations", "GET", { cookie: sessionCookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.observations)).toBe(true);
  });

  it("GET /api/analytics/multi-report: computes multi-report comparative biomarker analytics", async () => {
    const res = await getMultiReportAnalytics(req("/api/analytics/multi-report", "GET", { cookie: sessionCookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary).toBeDefined();
    expect(Array.isArray(data.biomarkers)).toBe(true);
    expect(Array.isArray(data.medicationCorrelations)).toBe(true);
    expect(Array.isArray(data.insights)).toBe(true);
  });

  it("GET /api/observations/[id]: reads specific observation", async () => {
    const res = await getObservationById(
      req(`/api/observations/${createdObsId}`, "GET", { cookie: sessionCookie }),
      { params: Promise.resolve({ id: createdObsId }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.observation.name).toBe("Platelet Count");
  });

  it("PATCH /api/observations/[id]: updates observation value and status", async () => {
    const res = await patchObservationById(
      req(`/api/observations/${createdObsId}`, "PATCH", {
        cookie: sessionCookie,
        body: { value: "260", verificationStatus: "confirmed" },
      }),
      { params: Promise.resolve({ id: createdObsId }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.observation.value).toBe("260");
  });

  it("DELETE /api/observations/[id]: deletes an observation", async () => {
    const res = await deleteObservationById(
      req(`/api/observations/${createdObsId}`, "DELETE", { cookie: sessionCookie }),
      { params: Promise.resolve({ id: createdObsId }) }
    );
    expect(res.status).toBe(200);
  });

  // 9. Medications & Schedules
  it("POST /api/medications: creates medication and schedule", async () => {
    const res = await postMedications(
      req("/api/medications", "POST", {
        cookie: sessionCookie,
        body: {
          name: "Metformin Hydrochloride",
          strength: "500 mg",
          instructions: "Take twice daily after meals",
          times: ["08:00", "20:00"],
        },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.medication.id).toBeDefined();
    createdMedId = data.medication.id;
  });

  it("GET /api/medications: lists user medications", async () => {
    const res = await getMedications(req("/api/medications", "GET", { cookie: sessionCookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.medications)).toBe(true);
  });

  it("GET /api/medications/[id]: retrieves specific medication with schedule", async () => {
    const res = await getMedicationById(
      req(`/api/medications/${createdMedId}`, "GET", { cookie: sessionCookie }),
      { params: Promise.resolve({ id: createdMedId }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.medication.name).toBe("Metformin Hydrochloride");
  });

  it("PATCH /api/medications/[id]: modifies status", async () => {
    const res = await patchMedicationById(
      req(`/api/medications/${createdMedId}`, "PATCH", {
        cookie: sessionCookie,
        body: { status: "paused" },
      }),
      { params: Promise.resolve({ id: createdMedId }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.medication.status).toBe("paused");
  });

  it("POST /api/medications/[id]/schedule: updates dosage schedule times", async () => {
    const res = await postMedicationSchedule(
      req(`/api/medications/${createdMedId}/schedule`, "POST", {
        cookie: sessionCookie,
        body: { times: ["09:00", "21:00"], enabled: true },
      }),
      { params: Promise.resolve({ id: createdMedId }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.schedule.times).toEqual(["09:00", "21:00"]);
  });

  // 10. Appointments
  it("POST /api/appointments: schedules a medical visit", async () => {
    const res = await postAppointments(
      req("/api/appointments", "POST", {
        cookie: sessionCookie,
        body: {
          title: "Quarterly Endocrinology Review",
          facility: "Apollo Clinic",
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          notes: "Fasting blood sugar review",
        },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.appointment.id).toBeDefined();
    createdApptId = data.appointment.id;
  });

  it("GET /api/appointments: lists user appointments", async () => {
    const res = await getAppointments(req("/api/appointments", "GET", { cookie: sessionCookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.appointments)).toBe(true);
  });

  it("PATCH /api/appointments/[id]: updates appointment notes", async () => {
    const res = await patchAppointmentById(
      req(`/api/appointments/${createdApptId}`, "PATCH", {
        cookie: sessionCookie,
        body: { notes: "Updated review notes" },
      }),
      { params: Promise.resolve({ id: createdApptId }) }
    );
    expect(res.status).toBe(200);
  });

  it("DELETE /api/appointments/[id]: cancels/deletes appointment", async () => {
    const res = await deleteAppointmentById(
      req(`/api/appointments/${createdApptId}`, "DELETE", { cookie: sessionCookie }),
      { params: Promise.resolve({ id: createdApptId }) }
    );
    expect(res.status).toBe(200);
  });

  // 11. Visits
  it("POST /api/visits: creates doctor visit summary", async () => {
    const res = await postVisits(
      req("/api/visits", "POST", {
        cookie: sessionCookie,
        body: {
          title: "General Physician Health Checkup",
          content: "Patient is feeling energetic. Blood pressure is in normal range.",
          questions: ["Should I continue Vitamin D supplement?"],
        },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.visit.id).toBeDefined();
    createdVisitId = data.visit.id;
  });

  it("GET /api/visits: lists user visit summaries", async () => {
    const res = await getVisits(req("/api/visits", "GET", { cookie: sessionCookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.visits)).toBe(true);
  });

  it("GET /api/visits/[id]: fetches doctor visit summary", async () => {
    const res = await getVisitById(
      req(`/api/visits/${createdVisitId}`, "GET", { cookie: sessionCookie }),
      { params: Promise.resolve({ id: createdVisitId }) }
    );
    expect(res.status).toBe(200);
  });

  it("PATCH /api/visits/[id]: updates doctor visit summary", async () => {
    const res = await patchVisitById(
      req(`/api/visits/${createdVisitId}`, "PATCH", {
        cookie: sessionCookie,
        body: { content: "Updated consultation advice." },
      }),
      { params: Promise.resolve({ id: createdVisitId }) }
    );
    expect(res.status).toBe(200);
  });

  it("DELETE /api/visits/[id]: deletes visit summary", async () => {
    const res = await deleteVisitById(
      req(`/api/visits/${createdVisitId}`, "DELETE", { cookie: sessionCookie }),
      { params: Promise.resolve({ id: createdVisitId }) }
    );
    expect(res.status).toBe(200);
  });

  // 12. Timeline
  it("POST /api/timeline: records chronological health event", async () => {
    const res = await postTimeline(
      req("/api/timeline", "POST", {
        cookie: sessionCookie,
        body: {
          type: "consultation",
          summary: "Dietitian nutritional counseling completed.",
        },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.event.id).toBeDefined();
    createdTimelineId = data.event.id;
  });

  it("GET /api/timeline: lists health timeline events", async () => {
    const res = await getTimeline(req("/api/timeline", "GET", { cookie: sessionCookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.timeline)).toBe(true);
  });

  it("GET /api/timeline/[id]: reads specific timeline event", async () => {
    const res = await getTimelineById(
      req(`/api/timeline/${createdTimelineId}`, "GET", { cookie: sessionCookie }),
      { params: Promise.resolve({ id: createdTimelineId }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.event.summary).toBe("Dietitian nutritional counseling completed.");
  });

  it("DELETE /api/timeline/[id]: deletes timeline event", async () => {
    const res = await deleteTimelineById(
      req(`/api/timeline/${createdTimelineId}`, "DELETE", { cookie: sessionCookie }),
      { params: Promise.resolve({ id: createdTimelineId }) }
    );
    expect(res.status).toBe(200);
  });

  // 13. Assistant & Conversations
  it("GET /api/assistant/conversations: lists user conversations", async () => {
    const res = await getConversations(req("/api/assistant/conversations", "GET", { cookie: sessionCookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.conversations)).toBe(true);
  });

  it("POST /api/assistant/conversations: starts a consultation session", async () => {
    const res = await postConversations(
      req("/api/assistant/conversations", "POST", {
        cookie: sessionCookie,
        body: { title: "Diabetes Care Questions" },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.conversation.id).toBeDefined();
    createdConvId = data.conversation.id;
  });

  it("GET /api/assistant/conversations/[id]/messages: retrieves conversation history", async () => {
    const res = await getConversationMessages(
      req(`/api/assistant/conversations/${createdConvId}/messages`, "GET", { cookie: sessionCookie }),
      { params: Promise.resolve({ id: createdConvId }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.messages)).toBe(true);
  });

  it("POST /api/assistant/chat: answers query with grounded fallback safety", async () => {
    const res = await assistantChat(
      req("/api/assistant/chat", "POST", {
        cookie: sessionCookie,
        body: {
          conversationId: createdConvId,
          message: "What was my fasting glucose level?",
          language: "en",
        },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message.content).toBeDefined();
    expect(data.caution).toBeDefined();
  });

  it("POST /api/assistant/chat: blocks non-medical queries with clinical guardrail refusal", async () => {
    const res = await assistantChat(
      req("/api/assistant/chat", "POST", {
        cookie: sessionCookie,
        body: {
          conversationId: createdConvId,
          message: "Write a python script to scrape data from websites",
          language: "en",
        },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message.content).toContain("AyuvSaathi Clinical AI Assistant");
    expect(data.caution).toContain("Clinical Guardrail");
  });

  // 14. Care Nearby (with verified fallback)
  it("GET /api/care/nearby: returns nearby healthcare facilities", async () => {
    const res = await getNearbyCare(req("/api/care/nearby?lat=17.385&lon=78.4867&kind=hospital", "GET"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.places)).toBe(true);
    expect(data.places.length).toBeGreaterThan(0);
  }, 15000);

  // 15. Clean up Document & Medication
  it("DELETE /api/documents/[id]: deletes document", async () => {
    const res = await deleteDocumentById(
      req(`/api/documents/${createdDocId}`, "DELETE", { cookie: sessionCookie }),
      { params: Promise.resolve({ id: createdDocId }) }
    );
    expect(res.status).toBe(200);
  });

  it("DELETE /api/medications/[id]: deletes medication", async () => {
    const res = await deleteMedicationById(
      req(`/api/medications/${createdMedId}`, "DELETE", { cookie: sessionCookie }),
      { params: Promise.resolve({ id: createdMedId }) }
    );
    expect(res.status).toBe(200);
  });

  // 16. Sign-out
  it("POST /api/auth/sign-out: successfully clears session", async () => {
    const res = await signOut();
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("Max-Age=0");
  });
});
