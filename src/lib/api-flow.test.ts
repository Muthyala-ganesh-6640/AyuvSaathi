import { describe, it, expect } from "vitest";
import { POST as signUp } from "@/app/api/auth/sign-up/route";
import { POST as signIn } from "@/app/api/auth/sign-in/route";
import { GET as getMe } from "@/app/api/me/route";
import { POST as seedDemo } from "@/app/api/demo/seed/route";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { GET as getDocuments } from "@/app/api/documents/route";
import { GET as getObservations } from "@/app/api/observations/route";
import { GET as getMedications } from "@/app/api/medications/route";
import { GET as getTimeline, POST as addTimeline } from "@/app/api/timeline/route";
import { POST as assistantChat } from "@/app/api/assistant/chat/route";
import { NextRequest } from "next/server";

describe("Complete Architectural API Flow Integration", () => {
  const testEmail = `flow_${Date.now()}@example.com`;
  const testPassword = "Password123!";
  let sessionCookie: string = "";

  function createRequest(
    url: string,
    method: string,
    body?: Record<string, unknown>,
    cookie?: string,
  ) {
    const headers = new Headers({
      "content-type": "application/json",
      host: "localhost:3000",
    });
    if (cookie) {
      headers.set("cookie", cookie);
    }
    return new NextRequest(`http://localhost:3000${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("1. Sign-up: successfully creates a user and returns authentication session", async () => {
    const req = createRequest("/api/auth/sign-up", "POST", {
      email: testEmail,
      password: testPassword,
      displayName: "Flow Test User",
      interfaceLanguage: "en",
    });
    const res = await signUp(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    if (setCookie) {
      sessionCookie = setCookie.split(";")[0];
    }
  });

  it("2. Sign-in: authenticates properly with correct credentials", async () => {
    const req = createRequest("/api/auth/sign-in", "POST", {
      email: testEmail,
      password: testPassword,
    });
    const res = await signIn(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.language).toBe("en");
  });

  it("3. Authenticated session /api/me: returns user profile data", async () => {
    const req = createRequest("/api/me", "GET", undefined, sessionCookie);
    const res = await getMe(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(testEmail.toLowerCase());
    expect(data.user.displayName).toBe("Flow Test User");
  });

  it("4. Demo Seed /api/demo/seed: seeds clinical demo records for authenticated user", async () => {
    const req = createRequest("/api/demo/seed", "POST", {}, sessionCookie);
    const res = await seedDemo(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("5. Dashboard /api/dashboard: returns categorized medical records and statistics", async () => {
    const req = createRequest("/api/dashboard", "GET", undefined, sessionCookie);
    const res = await getDashboard(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.email).toBe(testEmail.toLowerCase());
    expect(data.documents.length).toBeGreaterThan(0);
    expect(data.medicines.length).toBeGreaterThan(0);
    expect(data.stats).toBeDefined();
  });

  it("6. Documents /api/documents: lists patient records", async () => {
    const req = createRequest("/api/documents", "GET", undefined, sessionCookie);
    const res = await getDocuments(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.documents)).toBe(true);
    expect(data.documents.length).toBeGreaterThan(0);
  });

  it("7. Observations /api/observations: lists verified laboratory measurements", async () => {
    const req = createRequest("/api/observations", "GET", undefined, sessionCookie);
    const res = await getObservations(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.observations)).toBe(true);
    expect(data.observations.length).toBeGreaterThan(0);
  });

  it("8. Medications /api/medications: lists active prescriptions and schedules", async () => {
    const req = createRequest("/api/medications", "GET", undefined, sessionCookie);
    const res = await getMedications(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.medications)).toBe(true);
    expect(data.medications.length).toBeGreaterThan(0);
  });

  it("9. Timeline /api/timeline: adds and lists chronological health events", async () => {
    const addReq = createRequest(
      "/api/timeline",
      "POST",
      {
        type: "consultation",
        summary: "Routine checkup conducted.",
        eventDate: new Date().toISOString(),
      },
      sessionCookie,
    );
    const addRes = await addTimeline(addReq);
    expect(addRes.status).toBe(200);

    const listReq = createRequest("/api/timeline", "GET", undefined, sessionCookie);
    const listRes = await getTimeline(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.timeline.some((t: { summary: string }) => t.summary === "Routine checkup conducted.")).toBe(true);
  });

  it("10. Assistant /api/assistant/chat: answers grounded questions using confirmed records", async () => {
    const req = createRequest(
      "/api/assistant/chat",
      "POST",
      {
        message: "What was my hemoglobin value?",
      },
      sessionCookie,
    );
    const res = await assistantChat(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBeDefined();
    expect(data.message.content).toContain("Hemoglobin");
    expect(data.message.content).toContain("13.4");
  });
});
