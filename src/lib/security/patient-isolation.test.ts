import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { store } from "@/lib/db/file-store";
import { createSession } from "@/lib/auth/session";
import { GET as professionalPatientsGet } from "@/app/api/professional/patients/route";
import { GET as qrTokenGet } from "@/app/api/qr/token/route";
import { POST as qrResolvePost } from "@/app/api/qr/resolve/route";
import { POST as prescriptionPost } from "@/app/api/prescriptions/route";
import { GET as connectionsGet, PATCH as connectionsPatch } from "@/app/api/connections/route";
import { GET as dashboardGet } from "@/app/api/dashboard/route";
import { POST as switchRolePost } from "@/app/api/auth/switch-role/route";
import { getDashboardForRole, isRouteAllowedForRole } from "@/lib/auth/roles";
import type { Profile } from "@/lib/db/types";

describe("Patient Isolation, Multi-Domain Routing & Security", () => {
  let patient1: Profile;
  let patient2: Profile;
  let doctorA: Profile;
  let doctorB: Profile;
  let labTech: Profile;
  let pharmacist: Profile;

  let sessionPatient1: string;
  let sessionDoctorA: string;
  let sessionDoctorB: string;
  let sessionLabTech: string;
  let sessionPharmacist: string;

  beforeEach(async () => {
    const timestamp = Date.now();

    // Patient 1
    patient1 = await store.upsertProfile({
      id: crypto.randomUUID(),
      email: `patient1-${timestamp}@ayuvsaathi.in`,
      passwordHash: "hash123",
      displayName: "Patient One",
      role: "patient",
      ayuvSaathiId: "AS-P-ONE",
      interfaceLanguage: "en",
      aiLanguage: "en",
      timezone: "Asia/Kolkata",
      notifyReminders: true,
      onboardingComplete: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    sessionPatient1 = (await createSession(patient1)).token;

    // Patient 2
    patient2 = await store.upsertProfile({
      id: crypto.randomUUID(),
      email: `patient2-${timestamp}@ayuvsaathi.in`,
      passwordHash: "hash123",
      displayName: "Patient Two",
      role: "patient",
      ayuvSaathiId: "AS-P-TWO",
      interfaceLanguage: "en",
      aiLanguage: "en",
      timezone: "Asia/Kolkata",
      notifyReminders: true,
      onboardingComplete: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Doctor A
    doctorA = await store.upsertProfile({
      id: crypto.randomUUID(),
      email: `doctorA-${timestamp}@apollo.org`,
      passwordHash: "hash123",
      displayName: "Dr. Arvind (Doctor A)",
      role: "doctor",
      ayuvSaathiId: "AS-DOC-A",
      doctorProfile: {
        medicalRegistrationNumber: "MCI-11111",
        specialization: "Cardiology",
        qualification: "MBBS, MD",
        hospitalClinicName: "Apollo Hospital",
        hospitalClinicAddress: "Hyderabad",
        contactNumber: "+91 98490 00001",
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
    sessionDoctorA = (await createSession(doctorA)).token;

    // Doctor B
    doctorB = await store.upsertProfile({
      id: crypto.randomUUID(),
      email: `doctorB-${timestamp}@care.org`,
      passwordHash: "hash123",
      displayName: "Dr. Bhavana (Doctor B)",
      role: "doctor",
      ayuvSaathiId: "AS-DOC-B",
      doctorProfile: {
        medicalRegistrationNumber: "MCI-22222",
        specialization: "Neurology",
        qualification: "MBBS, DM",
        hospitalClinicName: "Care Hospital",
        hospitalClinicAddress: "Hyderabad",
        contactNumber: "+91 98490 00002",
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
    sessionDoctorB = (await createSession(doctorB)).token;

    // Lab Tech
    labTech = await store.upsertProfile({
      id: crypto.randomUUID(),
      email: `lab-${timestamp}@aster.in`,
      passwordHash: "hash123",
      displayName: "Rajesh (Lab Tech)",
      role: "lab_tech",
      ayuvSaathiId: "AS-LAB-RAJESH",
      labTechProfile: {
        technicianId: "TECH-99",
        qualification: "M.Sc Biochemistry",
        labName: "Aster Labs",
        labAddress: "Hyderabad",
        contactNumber: "+91 98490 00003",
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
    sessionLabTech = (await createSession(labTech)).token;

    // Pharmacist
    pharmacist = await store.upsertProfile({
      id: crypto.randomUUID(),
      email: `pharma-${timestamp}@medplus.in`,
      passwordHash: "hash123",
      displayName: "Priya (Pharmacist)",
      role: "pharmacist",
      ayuvSaathiId: "AS-PHARM-PRIYA",
      pharmacistProfile: {
        licenseNumber: "TS-PHARM-8888",
        qualification: "B.Pharm",
        pharmacyName: "MedPlus",
        pharmacyAddress: "Hyderabad",
        contactNumber: "+91 98490 00004",
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
    sessionPharmacist = (await createSession(pharmacist)).token;
  });

  it("1. Prevents global patient leakage: Doctor B cannot see Patient 1 when only Doctor A has access", async () => {
    // Patient 1 generates QR code
    const qrReq = new NextRequest("http://localhost:3000/api/qr/token", {
      headers: { cookie: `arogya_session=${sessionPatient1}` },
    });
    const qrRes = await qrTokenGet(qrReq);
    const { token: qrToken } = await qrRes.json();
    expect(qrToken).toBeDefined();

    // Doctor A scans and resolves Patient 1's QR code
    const resolveReq = new NextRequest("http://localhost:3000/api/qr/resolve", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `arogya_session=${sessionDoctorA}`,
      },
      body: JSON.stringify({ token: qrToken }),
    });
    const resolveRes = await qrResolvePost(resolveReq);
    expect(resolveRes.status).toBe(200);

    // Doctor A lists authorized patients -> MUST see Patient 1
    const docAPatientsReq = new NextRequest("http://localhost:3000/api/professional/patients", {
      headers: { cookie: `arogya_session=${sessionDoctorA}` },
    });
    const docAPatientsRes = await professionalPatientsGet(docAPatientsReq);
    const docAData = await docAPatientsRes.json();
    expect(docAData.ok).toBe(true);
    expect(docAData.patients.length).toBe(1);
    expect(docAData.patients[0].id).toBe(patient1.id);

    // CRITICAL: Doctor B lists authorized patients -> MUST SEE ZERO PATIENTS
    const docBPatientsReq = new NextRequest("http://localhost:3000/api/professional/patients", {
      headers: { cookie: `arogya_session=${sessionDoctorB}` },
    });
    const docBPatientsRes = await professionalPatientsGet(docBPatientsReq);
    const docBData = await docBPatientsRes.json();
    expect(docBData.ok).toBe(true);
    expect(docBData.patients.length).toBe(0); // Zero leakage!

    // CRITICAL: Doctor B attempts direct object reference query (?patientId=patient1.id) -> MUST BE REJECTED 403
    const idorReq = new NextRequest(`http://localhost:3000/api/professional/patients?patientId=${patient1.id}`, {
      headers: { cookie: `arogya_session=${sessionDoctorB}` },
    });
    const idorRes = await professionalPatientsGet(idorReq);
    expect(idorRes.status).toBe(403);
  });

  it("2. Doctor B cannot issue prescriptions for an unshared patient", async () => {
    // Doctor B tries to prescribe for Patient 1 without authorization grant
    const prescribeReq = new NextRequest("http://localhost:3000/api/prescriptions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `arogya_session=${sessionDoctorB}`,
      },
      body: JSON.stringify({
        patientProfileId: patient1.id,
        diagnosis: "Unauthorized Prescription Attempt",
        items: [
          {
            medicineName: "Sedative X",
            dosage: "100mg",
            frequency: "Daily",
            duration: "30 days",
            instructions: "Take as directed",
          },
        ],
      }),
    });
    const prescribeRes = await prescriptionPost(prescribeReq);
    expect(prescribeRes.status).toBe(403); // Strict server-side rejection!
  });

  it("3. Independent multi-doctor grants: Revoking Doctor A does NOT revoke Doctor B", async () => {
    // Generate QR for Patient 1
    const qrReq = new NextRequest("http://localhost:3000/api/qr/token", {
      headers: { cookie: `arogya_session=${sessionPatient1}` },
    });
    const { token: qrToken } = await (await qrTokenGet(qrReq)).json();

    // Doctor A connects
    await qrResolvePost(
      new NextRequest("http://localhost:3000/api/qr/resolve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `arogya_session=${sessionDoctorA}`,
        },
        body: JSON.stringify({ token: qrToken }),
      }),
    );

    // Doctor B connects
    await qrResolvePost(
      new NextRequest("http://localhost:3000/api/qr/resolve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `arogya_session=${sessionDoctorB}`,
        },
        body: JSON.stringify({ token: qrToken }),
      }),
    );

    // Both doctors can now access Patient 1
    const checkA1 = await professionalPatientsGet(
      new NextRequest(`http://localhost:3000/api/professional/patients?patientId=${patient1.id}`, {
        headers: { cookie: `arogya_session=${sessionDoctorA}` },
      }),
    );
    expect(checkA1.status).toBe(200);

    const checkB1 = await professionalPatientsGet(
      new NextRequest(`http://localhost:3000/api/professional/patients?patientId=${patient1.id}`, {
        headers: { cookie: `arogya_session=${sessionDoctorB}` },
      }),
    );
    expect(checkB1.status).toBe(200);

    // Patient 1 lists connections and revokes Doctor A
    const connListRes = await connectionsGet(
      new NextRequest("http://localhost:3000/api/connections", {
        headers: { cookie: `arogya_session=${sessionPatient1}` },
      }),
    );
    const { connections } = await connListRes.json();
    const connDoctorA = connections.find((c: any) => c.professionalId === doctorA.id);
    expect(connDoctorA).toBeDefined();

    // Revoke Doctor A
    const revokeRes = await connectionsPatch(
      new NextRequest("http://localhost:3000/api/connections", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `arogya_session=${sessionPatient1}`,
        },
        body: JSON.stringify({ id: connDoctorA.id, status: "revoked" }),
      }),
    );
    expect(revokeRes.status).toBe(200);

    // Doctor A must now be immediately REJECTED (403)
    const checkA2 = await professionalPatientsGet(
      new NextRequest(`http://localhost:3000/api/professional/patients?patientId=${patient1.id}`, {
        headers: { cookie: `arogya_session=${sessionDoctorA}` },
      }),
    );
    expect(checkA2.status).toBe(403);

    // CRITICAL: Doctor B still has an active grant and can still access Patient 1
    const checkB2 = await professionalPatientsGet(
      new NextRequest(`http://localhost:3000/api/professional/patients?patientId=${patient1.id}`, {
        headers: { cookie: `arogya_session=${sessionDoctorB}` },
      }),
    );
    expect(checkB2.status).toBe(200);
  });

  it("4. Non-clinician roles: Lab Tech and Pharmacist cannot perform doctor-only operations", async () => {
    // Lab Tech tries to create a prescription -> 403 Forbidden
    const labPrescribeRes = await prescriptionPost(
      new NextRequest("http://localhost:3000/api/prescriptions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `arogya_session=${sessionLabTech}`,
        },
        body: JSON.stringify({
          patientProfileId: patient1.id,
          diagnosis: "Test",
          items: [{ medicineName: "Meds", dosage: "10mg", frequency: "Daily", duration: "5 days", instructions: "None" }],
        }),
      }),
    );
    expect(labPrescribeRes.status).toBe(403);

    // Pharmacist tries to create a prescription -> 403 Forbidden
    const pharmPrescribeRes = await prescriptionPost(
      new NextRequest("http://localhost:3000/api/prescriptions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `arogya_session=${sessionPharmacist}`,
        },
        body: JSON.stringify({
          patientProfileId: patient1.id,
          diagnosis: "Test",
          items: [{ medicineName: "Meds", dosage: "10mg", frequency: "Daily", duration: "5 days", instructions: "None" }],
        }),
      }),
    );
    expect(pharmPrescribeRes.status).toBe(403);
  });

  it("5. Dashboard IDOR prevention: Patient 2 cannot access Patient 1's dashboard records", async () => {
    // Patient 2 requests dashboard for Patient 1
    const idorDashboardReq = new NextRequest(
      `http://localhost:3000/api/dashboard?patientProfileId=${patient1.id}`,
      { headers: { cookie: `arogya_session=${(await createSession(patient2)).token}` } },
    );
    const idorDashboardRes = await dashboardGet(idorDashboardReq);
    expect(idorDashboardRes.status).toBe(403); // Strict rejection
  });

  it("6. Canonical domain mapping and route guard rules (Patient and Doctor dashboards only)", () => {
    // Verify each role maps to its exact dashboard
    expect(getDashboardForRole("patient")).toBe("/en/dashboard");
    expect(getDashboardForRole("doctor")).toBe("/en/doctor");

    // Route allowance validation
    expect(isRouteAllowedForRole("/en/dashboard", "patient")).toBe(true);
    expect(isRouteAllowedForRole("/en/dashboard", "doctor")).toBe(false);
    expect(isRouteAllowedForRole("/en/doctor", "doctor")).toBe(true);
    expect(isRouteAllowedForRole("/en/doctor", "patient")).toBe(false);
    // Removed dashboards: Lab and Pharmacy routes are rejected
    expect(isRouteAllowedForRole("/en/lab", "lab_tech")).toBe(false);
    expect(isRouteAllowedForRole("/en/lab", "doctor")).toBe(false);
    expect(isRouteAllowedForRole("/en/pharmacy", "pharmacist")).toBe(false);
    expect(isRouteAllowedForRole("/en/pharmacy", "patient")).toBe(false);
  });

  it("7. Supported role switching updates session context and target dashboard", async () => {
    // Doctor A switches domain to Patient
    const switchReq = new NextRequest("http://localhost:3000/api/auth/switch-role", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `arogya_session=${sessionDoctorA}`,
      },
      body: JSON.stringify({ targetRole: "patient" }),
    });
    const switchRes = await switchRolePost(switchReq);
    const switchData = await switchRes.json();
    expect(switchRes.status).toBe(200);
    expect(switchData.role).toBe("patient");
    expect(switchData.redirectUrl).toBe("/en/dashboard");

    // Plain Patient 1 tries to switch to Doctor without a doctor profile -> 403 Forbidden
    const invalidSwitchReq = new NextRequest("http://localhost:3000/api/auth/switch-role", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `arogya_session=${sessionPatient1}`,
      },
      body: JSON.stringify({ targetRole: "doctor" }),
    });
    const invalidSwitchRes = await switchRolePost(invalidSwitchReq);
    expect(invalidSwitchRes.status).toBe(403);
  });
});
