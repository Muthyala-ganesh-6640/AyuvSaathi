import { describe, it, expect } from "vitest";
import { POST as resetHandler } from "@/app/api/auth/reset/route";
import { POST as signInHandler } from "@/app/api/auth/sign-in/route";
import { store } from "@/lib/db/file-store";
import { hashPassword } from "@/lib/auth/password";
import { NextRequest } from "next/server";

describe("Password Reset Delivery and Confirmation Flow", () => {
  const testEmail = `reset_test_${Date.now()}@example.com`;
  const initialPassword = "InitialPassword123!";
  const newPassword = "NewSecuredPassword456!";
  let issuedToken = "";

  function createReq(body: Record<string, unknown>) {
    return new NextRequest("http://localhost:3000/api/auth/reset", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:3000" },
      body: JSON.stringify(body),
    });
  }

  it("1. Sets up a test user in store", async () => {
    const profile = await store.upsertProfile({
      id: crypto.randomUUID(),
      email: testEmail,
      passwordHash: await hashPassword(initialPassword),
      displayName: "Reset Test Patient",
      interfaceLanguage: "en",
      aiLanguage: "en",
      timezone: "Asia/Kolkata",
      notifyReminders: true,
      onboardingComplete: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(profile.id).toBeDefined();
  });

  it("2. Requesting reset returns ok and recovery token", async () => {
    const req = createReq({ email: testEmail });
    const res = await resetHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.accountExists).toBe(true);
    expect(data.developmentToken).toBeDefined();
    expect(data.developmentToken.length).toBeGreaterThan(20);
    issuedToken = data.developmentToken;
  });

  it("3. Reject invalid or weak passwords", async () => {
    const req = createReq({ token: issuedToken, password: "short" });
    const res = await resetHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("at least 10 characters");
  });

  it("4. Successfully resets password with valid token", async () => {
    const req = createReq({ token: issuedToken, password: newPassword });
    const res = await resetHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("5. Can authenticate with new password via sign-in", async () => {
    const signInReq = new NextRequest("http://localhost:3000/api/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:3000" },
      body: JSON.stringify({ email: testEmail, password: newPassword }),
    });
    const res = await signInHandler(signInReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("6. Old password no longer works", async () => {
    const signInReq = new NextRequest("http://localhost:3000/api/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:3000" },
      body: JSON.stringify({ email: testEmail, password: initialPassword }),
    });
    const res = await signInHandler(signInReq);
    expect(res.status).toBe(401);
  });
});
