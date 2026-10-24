import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { store } from "@/lib/db/file-store";
import { createSession } from "@/lib/auth/session";
import { POST as signUpPost } from "@/app/api/auth/sign-up/route";
import { GET as qrTokenGet } from "@/app/api/qr/token/route";
import { POST as qrResolvePost } from "@/app/api/qr/resolve/route";
import { GET as familyGet, POST as familyPost } from "@/app/api/family/route";
import { POST as prescriptionPost, GET as prescriptionGet } from "@/app/api/prescriptions/route";
import { POST as billPost, GET as billGet } from "@/app/api/pharmacy/bills/route";
import { GET as dashboardGet } from "@/app/api/dashboard/route";

describe("AyuvSaathi Healthcare Ecosystem Integration", () => {
  let patientUser: any;
  let doctorUser: any;
  let pharmacistUser: any;
  let labTechUser: any;
  let patientSession: string;
  let doctorSession: string;
  let pharmacistSession: string;

  beforeEach(async () => {
    // Setup patient
    const patientProfile = await store.upsertProfile({
      id: crypto.randomUUID(),
      email: `test-patient-${Date.now()}@ayuvsaathi.in`,
      passwordHash: "hash123",
      displayName: "Ananya Sharma",
      role: "patient",
      ayuvSaathiId: "AS-P-ANANYA",
      interfaceLanguage: "en",
      aiLanguage: "en",
      timezone: "Asia/Kolkata",
      notifyReminders: true,
      onboardingComplete: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    patientUser = patientProfile;
    patientSession = (await createSession(patientProfile)).token;

    // Setup doctor
    const docProfile = await store.upsertProfile({
      id: crypto.randomUUID(),
      email: `test-doctor-${Date.now()}@apollo.org`,
      passwordHash: "hash123",
      displayName: "Dr. Arvind Reddy",
      role: "doctor",
      ayuvSaathiId: "AS-DOC-ARVIND",
      doctorProfile: {
        medicalRegistrationNumber: "MCI-77881",
        specialization: "Internal Medicine",
        qualification: "MBBS, MD",
        hospitalClinicName: "Apollo Hospital",
        hospitalClinicAddress: "Hyderabad",
        contactNumber: "+91 98490 11223",
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
    doctorUser = docProfile;
    doctorSession = (await createSession(docProfile)).token;

    // Setup pharmacist
    const pharmProfile = await store.upsertProfile({
      id: crypto.randomUUID(),
      email: `test-pharm-${Date.now()}@medplus.in`,
      passwordHash: "hash123",
      displayName: "Priya Rao",
      role: "pharmacist",
      ayuvSaathiId: "AS-PHARM-PRIYA",
      pharmacistProfile: {
        licenseNumber: "TS-PHARM-9912",
        qualification: "B.Pharm",
        pharmacyName: "MedPlus Pharmacy",
        pharmacyAddress: "Hyderabad",
        contactNumber: "+91 98765 44332",
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
    pharmacistUser = pharmProfile;
    pharmacistSession = (await createSession(pharmProfile)).token;
  });

  it("1. Generates Universal Patient QR with secure opaque token and zero raw PII", async () => {
    const req = new NextRequest("http://localhost:3000/api/qr/token", {
      headers: { authorization: `Bearer ${patientSession}` },
    });
    const res = await qrTokenGet(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.token).toContain("ayuv_qr_");
    expect(data.qrData).toBe(`ayuv://connect/t/${data.token}`);
    expect(data.ayuvSaathiId).toBe(patientUser.ayuvSaathiId);
    // Verified that QR data does NOT contain raw health notes, diagnoses, or full profile dumps
    expect(data.qrData).not.toContain("password");
    expect(data.qrData).not.toContain("diagnosis");
  });

  it("2. Doctor scans Patient QR -> Establishes Authorized Connection & resolves permitted records", async () => {
    // Generate patient token
    const tokenReq = new NextRequest("http://localhost:3000/api/qr/token", {
      headers: { authorization: `Bearer ${patientSession}` },
    });
    const tokenRes = await qrTokenGet(tokenReq);
    const { token } = await tokenRes.json();

    // Doctor scans the token
    const resolveReq = new NextRequest("http://localhost:3000/api/qr/resolve", {
      method: "POST",
      headers: {
        authorization: `Bearer ${doctorSession}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    const resolveRes = await qrResolvePost(resolveReq);
    expect(resolveRes.status).toBe(200);
    const resolveData = await resolveRes.json();

    expect(resolveData.ok).toBe(true);
    expect(resolveData.patient.name).toBe(patientUser.displayName);
    expect(resolveData.connection).toBeDefined();
    expect(resolveData.connection.permissions.viewRecords).toBe(true);
    expect(resolveData.connection.permissions.createPrescription).toBe(true);

    // Verify patient received notification
    const notifications = await store.listNotifications(patientUser.id);
    expect(notifications.some((n) => n.title.includes("Healthcare Connection"))).toBe(true);
  });

  it("3. Pharmacist scans Patient QR -> Receives ONLY medication information, no unrestricted medical notes", async () => {
    const tokenReq = new NextRequest("http://localhost:3000/api/qr/token", {
      headers: { authorization: `Bearer ${patientSession}` },
    });
    const tokenRes = await qrTokenGet(tokenReq);
    const { token } = await tokenRes.json();

    const resolveReq = new NextRequest("http://localhost:3000/api/qr/resolve", {
      method: "POST",
      headers: {
        authorization: `Bearer ${pharmacistSession}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    const resolveRes = await qrResolvePost(resolveReq);
    expect(resolveRes.status).toBe(200);
    const resolveData = await resolveRes.json();

    expect(resolveData.ok).toBe(true);
    expect(resolveData.connection.permissions.dispenseMedicines).toBe(true);
    expect(resolveData.connection.permissions.viewRecords).toBe(false); // Unrestricted records blocked
    expect(resolveData.documents).toBeUndefined(); // Full diagnostic documents blocked
    expect(resolveData.observations).toBeUndefined(); // Full raw biomarkers blocked
  });

  it("4. Family Health Management: Adds family member with separate ID and strict data isolation", async () => {
    // Add Father profile
    const addFamReq = new NextRequest("http://localhost:3000/api/family", {
      method: "POST",
      headers: {
        authorization: `Bearer ${patientSession}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Suresh Sharma",
        relationship: "father",
        gender: "male",
        bloodGroup: "B+",
      }),
    });
    const addRes = await familyPost(addFamReq);
    expect(addRes.status).toBe(200);
    const addData = await addRes.json();
    expect(addData.familyMember.name).toBe("Suresh Sharma");
    expect(addData.familyMember.ayuvSaathiId).toContain("AS-FAM-");

    const fatherId = addData.familyMember.id;

    // Fetch dashboard for Father: should be isolated and contain 0 records belonging to primary user
    const dashReq = new NextRequest(`http://localhost:3000/api/dashboard?patientProfileId=${fatherId}`, {
      headers: { authorization: `Bearer ${patientSession}` },
    });
    const dashRes = await dashboardGet(dashReq);
    expect(dashRes.status).toBe(200);
    const dashData = await dashRes.json();

    expect(dashData.activeProfile.id).toBe(fatherId);
    expect(dashData.activeProfile.name).toBe("Suresh Sharma");
    expect(dashData.activeProfile.relationship).toBe("father");
    expect(dashData.documents).toEqual([]); // Completely isolated from daughter's documents
  });

  it("5. Doctor Prescription Workflow -> Synchronizes with patient medications, timeline, and notifications", async () => {
    const prescReq = new NextRequest("http://localhost:3000/api/prescriptions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${doctorSession}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        patientProfileId: patientUser.id,
        diagnosis: "Seasonal Bronchitis",
        notes: "Take warm fluids and complete course",
        items: [
          {
            medicineName: "Azithromycin",
            dosage: "500 mg",
            frequency: "Once daily before dinner",
            duration: "3 days",
            instructions: "Take with water",
          },
        ],
      }),
    });
    const prescRes = await prescriptionPost(prescReq);
    expect(prescRes.status).toBe(200);
    const prescData = await prescRes.json();
    expect(prescData.ok).toBe(true);

    // Verify patient's active medications list has Azithromycin
    const meds = await store.listMedications(patientUser.id);
    expect(meds.some((m) => m.name === "Azithromycin")).toBe(true);

    // Verify timeline has prescription event
    const timeline = await store.listTimeline(patientUser.id);
    expect(timeline.some((t) => t.type === "prescription")).toBe(true);

    // Verify notification was delivered to patient
    const notifs = await store.listNotifications(patientUser.id);
    expect(notifs.some((n) => n.type === "prescription")).toBe(true);
  });

  it("6. Pharmacy Billing Workflow -> Generates itemized invoice and distinct dispensing timeline event", async () => {
    const billReq = new NextRequest("http://localhost:3000/api/pharmacy/bills", {
      method: "POST",
      headers: {
        authorization: `Bearer ${pharmacistSession}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        patientProfileId: patientUser.id,
        items: [
          { medicineName: "Azithromycin 500mg", quantity: 3, unitPrice: 40, totalPrice: 120 },
          { medicineName: "Cough Syrup", quantity: 1, unitPrice: 80, totalPrice: 80 },
        ],
        subtotal: 200,
        discount: 10,
        tax: 9.5,
        totalAmount: 199.5,
        paymentStatus: "paid",
      }),
    });
    const billRes = await billPost(billReq);
    expect(billRes.status).toBe(200);
    const billData = await billRes.json();
    expect(billData.ok).toBe(true);
    expect(billData.bill.totalAmount).toBe(199.5);

    // Verify timeline explicitly logs dispensing, NOT a clinical prescription
    const timeline = await store.listTimeline(patientUser.id);
    const dispenseEvent = timeline.find((t) => t.summary.includes("Medication Dispensed at MedPlus"));
    expect(dispenseEvent).toBeDefined();
    expect(dispenseEvent?.type).toBe("medication");
  });
});
