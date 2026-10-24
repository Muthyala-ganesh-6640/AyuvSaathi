import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { store } from "@/lib/db/file-store";
import { createSession } from "@/lib/auth/session";
import { GET as getNotifications } from "@/app/api/notifications/route";
import { POST as markNotificationRead } from "@/app/api/notifications/read/route";
import { GET as getProfMessages, POST as postProfMessage } from "@/app/api/professional/messages/route";
import { GET as getConnections, PATCH as patchConnection } from "@/app/api/connections/route";
import { POST as switchRole } from "@/app/api/auth/switch-role/route";
import { GET as geocodeCare } from "@/app/api/care/geocode/route";
import { PATCH as updateDose } from "@/app/api/doses/[id]/route";

describe("Additional API Endpoints Verification & Validation", () => {
  let patientUser: any;
  let doctorUser: any;
  let patientCookie: string;
  let doctorCookie: string;
  let sampleDoseId: string;
  let sampleConnectionId: string;

  beforeAll(async () => {
    // Create patient
    const p = await store.upsertProfile({
      id: crypto.randomUUID(),
      email: `audit-patient-${Date.now()}@ayuvsaathi.in`,
      passwordHash: "hash123",
      displayName: "Audit Patient",
      role: "patient",
      interfaceLanguage: "en",
      aiLanguage: "en",
      timezone: "Asia/Kolkata",
      notifyReminders: true,
      onboardingComplete: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    patientUser = p;
    patientCookie = (await createSession(p)).cookieHeader;

    // Create doctor
    const d = await store.upsertProfile({
      id: crypto.randomUUID(),
      email: `audit-doctor-${Date.now()}@apollo.org`,
      passwordHash: "hash123",
      displayName: "Dr. Audit Rao",
      role: "doctor",
      doctorProfile: {
        medicalRegistrationNumber: "MCI-AUDIT-1",
        specialization: "General Medicine",
        qualification: "MBBS",
        hospitalClinicName: "City Clinic",
        hospitalClinicAddress: "Road 1, Hyderabad",
        contactNumber: "+91 99887 76655",
        verificationStatus: "verified",
      },
      interfaceLanguage: "en",
      aiLanguage: "en",
      timezone: "Asia/Kolkata",
      notifyReminders: true,
      onboardingComplete: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    doctorUser = d;
    doctorCookie = (await createSession(d)).cookieHeader;

    // Create sample connection
    const conn = await store.saveConnection({
      id: crypto.randomUUID(),
      patientProfileId: patientUser.id,
      primaryUserId: patientUser.id,
      professionalId: doctorUser.id,
      professionalRole: "doctor",
      professionalName: doctorUser.displayName,
      organizationName: "City Clinic",
      status: "active",
      permissions: {
        viewRecords: true,
        viewPrescriptions: true,
        createPrescription: true,
        uploadReports: false,
        dispenseMedicines: false,
      },
      lastInteractionAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    sampleConnectionId = conn.id;

    // Create a medication and a dose for patient
    const med = await store.saveMedication({
      id: crypto.randomUUID(),
      ownerId: patientUser.id,
      name: "Metformin",
      strength: "500 mg",
      instructions: "Take with food",
      status: "active",
      confirmationStatus: "confirmed",
      provenance: "user_entered",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const dose = await store.saveDose({
      id: crypto.randomUUID(),
      scheduleId: crypto.randomUUID(),
      ownerId: patientUser.id,
      medicationId: med.id,
      scheduledTime: "08:00",
      scheduledDate: new Date().toISOString().slice(0, 10),
      status: "pending",
      eventTime: undefined,
      source: "system",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    sampleDoseId = dose.id;
  });

  it("POST & GET /api/professional/messages: exchanges messages and retrieves conversation", async () => {
    // Send message from doctor to patient
    const postReq = new NextRequest("http://localhost:3000/api/professional/messages", {
      method: "POST",
      headers: {
        cookie: doctorCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        patientProfileId: patientUser.id,
        professionalId: doctorUser.id,
        message: "Please keep track of your daily fasting blood sugar readings.",
        isEmergency: false,
      }),
    });
    const postRes = await postProfMessage(postReq);
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.ok).toBe(true);
    expect(postData.message.message).toContain("fasting blood sugar");

    // Retrieve messages
    const getReq = new NextRequest(
      `http://localhost:3000/api/professional/messages?patientProfileId=${patientUser.id}&professionalId=${doctorUser.id}`,
      { headers: { cookie: doctorCookie } }
    );
    const getRes = await getProfMessages(getReq);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.ok).toBe(true);
    expect(getData.messages.length).toBeGreaterThan(0);
  });

  it("GET & POST /api/notifications & /api/notifications/read: handles notification retrieval and read status", async () => {
    // Patient checks notifications
    const getReq = new NextRequest("http://localhost:3000/api/notifications", {
      headers: { cookie: patientCookie },
    });
    const getRes = await getNotifications(getReq);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.ok).toBe(true);
    expect(Array.isArray(getData.notifications)).toBe(true);

    // Mark all notifications as read
    const readReq = new NextRequest("http://localhost:3000/api/notifications/read", {
      method: "POST",
      headers: {
        cookie: patientCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ all: true }),
    });
    const readRes = await markNotificationRead(readReq);
    expect(readRes.status).toBe(200);
    const readData = await readRes.json();
    expect(readData.ok).toBe(true);
  });

  it("PATCH /api/doses/[id]: marks scheduled dose as taken and logs timeline event", async () => {
    const doseReq = new NextRequest(`http://localhost:3000/api/doses/${sampleDoseId}`, {
      method: "PATCH",
      headers: {
        cookie: patientCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: "taken" }),
    });
    const doseRes = await updateDose(doseReq, { params: Promise.resolve({ id: sampleDoseId }) });
    expect(doseRes.status).toBe(200);
    const doseData = await doseRes.json();
    expect(doseData.dose.status).toBe("taken");

    // Check timeline entry
    const timeline = await store.listTimeline(patientUser.id);
    expect(timeline.some((t) => t.type === "dose" && t.summary.includes("Metformin"))).toBe(true);
  });

  it("GET & PATCH /api/connections: lists active connections and supports status updates", async () => {
    const getReq = new NextRequest(`http://localhost:3000/api/connections?patientProfileId=${patientUser.id}`, {
      headers: { cookie: patientCookie },
    });
    const getRes = await getConnections(getReq);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.ok).toBe(true);
    expect(getData.connections.length).toBeGreaterThan(0);

    // Update connection status
    const patchReq = new NextRequest("http://localhost:3000/api/connections", {
      method: "PATCH",
      headers: {
        cookie: patientCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ id: sampleConnectionId, status: "active" }),
    });
    const patchRes = await patchConnection(patchReq);
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.ok).toBe(true);
  });

  it("POST /api/auth/switch-role: validates role permissions and rejects unauthorized switches", async () => {
    // Patient attempts to switch to doctor without doctor credentials -> 403 Forbidden
    const invalidSwitchReq = new NextRequest("http://localhost:3000/api/auth/switch-role", {
      method: "POST",
      headers: {
        cookie: patientCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ targetRole: "doctor" }),
    });
    const invalidRes = await switchRole(invalidSwitchReq);
    expect(invalidRes.status).toBe(403);

    // Doctor switches to patient -> 200 OK with redirect
    const validSwitchReq = new NextRequest("http://localhost:3000/api/auth/switch-role", {
      method: "POST",
      headers: {
        cookie: doctorCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ targetRole: "patient" }),
    });
    const validRes = await switchRole(validSwitchReq);
    expect(validRes.status).toBe(200);
    const validData = await validRes.json();
    expect(validData.ok).toBe(true);
    expect(validData.redirectUrl).toBe("/en/dashboard");
  });

  it("GET /api/care/geocode: returns coordinates or handled fallback for valid/invalid queries", async () => {
    const emptyReq = new NextRequest("http://localhost:3000/api/care/geocode?q=", { method: "GET" });
    const emptyRes = await geocodeCare(emptyReq);
    expect(emptyRes.status).toBe(400);

    const validReq = new NextRequest("http://localhost:3000/api/care/geocode?q=Hyderabad", { method: "GET" });
    const validRes = await geocodeCare(validReq);
    // Either returns 200 with coordinates or 404/503 if network is isolated
    expect([200, 404, 503]).toContain(validRes.status);
  });
});
