import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as transcribeAudio } from "@/app/api/audio/transcribe/route";
import { POST as signUp } from "@/app/api/auth/sign-up/route";

describe("Audio Transcription Endpoint /api/audio/transcribe", () => {
  const testEmail = `transcribe_${Date.now()}@ayuvsaathi.in`;
  let sessionCookie = "";

  it("rejects unauthorized requests with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/audio/transcribe", {
      method: "POST",
    });
    const res = await transcribeAudio(req);
    expect(res.status).toBe(401);
  });

  it("authenticates and rejects requests missing an audio payload with 400", async () => {
    const signUpRes = await signUp(
      new NextRequest("http://localhost:3000/api/auth/sign-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: "AuditPassword123!",
          displayName: "Voice Patient",
          interfaceLanguage: "en",
        }),
      })
    );
    sessionCookie = signUpRes.headers.get("set-cookie") || "";
    expect(sessionCookie).toBeTruthy();

    const formData = new FormData();
    formData.append("language", "en");

    const req = new NextRequest("http://localhost:3000/api/audio/transcribe", {
      method: "POST",
      headers: {
        cookie: sessionCookie,
      },
      body: formData,
    });

    const res = await transcribeAudio(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("No audio recording provided");
  });

  it("handles audio file and forwards to speech transcription service", async () => {
    const prevKey = process.env.AI_API_KEY;
    process.env.AI_API_KEY = "mock-groq-key";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.groq.com")) {
        return new Response(JSON.stringify({ text: "What are my latest blood test results?" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url);
    });

    try {
      const formData = new FormData();
      const dummyAudio = new Blob([new Uint8Array(200)], { type: "audio/webm" });
      formData.append("audio", dummyAudio, "test.webm");
      formData.append("language", "en");

      const req = new NextRequest("http://localhost:3000/api/audio/transcribe", {
        method: "POST",
        headers: {
          cookie: sessionCookie,
        },
        body: formData,
      });

      const res = await transcribeAudio(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.transcript).toBe("What are my latest blood test results?");
    } finally {
      globalThis.fetch = originalFetch;
      process.env.AI_API_KEY = prevKey;
    }
  });
});
