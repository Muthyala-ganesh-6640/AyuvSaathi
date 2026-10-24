import { NextRequest } from "next/server";
import { jsonError, withUser } from "@/lib/api";
import { getEnv } from "@/lib/env";

export async function POST(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  try {
    const formData = await request.formData();
    const audioFile = formData.get("file") || formData.get("audio");
    const language = (formData.get("language") as string) || "en";

    if (!audioFile || !(audioFile instanceof Blob)) {
      return jsonError("No audio recording provided", 400);
    }

    if (audioFile.size < 50) {
      return jsonError("Audio recording is too short or empty", 400);
    }

    const env = getEnv();
    const apiKey =
      env.AI_API_KEY ||
      process.env.AI_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return jsonError("Speech transcription provider is not configured. Please set AI_API_KEY or GROQ_API_KEY.", 503);
    }

    // Forward audio to Groq Whisper endpoint
    const whisperFormData = new FormData();
    const filename = "recording.webm";
    whisperFormData.append("file", audioFile, filename);
    whisperFormData.append("model", "whisper-large-v3");

    if (language === "te") {
      whisperFormData.append("language", "te");
    } else if (language === "hi") {
      whisperFormData.append("language", "hi");
    } else {
      whisperFormData.append("language", "en");
    }

    whisperFormData.append(
      "prompt",
      "Medical and healthcare consultation query about symptoms, medicines, lab reports, and doctor visits in AyuvSaathi."
    );
    whisperFormData.append("temperature", "0");

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: whisperFormData,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      console.error("[Audio Transcribe] Groq Whisper error:", groqRes.status, errText);
      return jsonError("Speech-to-text service unavailable", 502);
    }

    const data = await groqRes.json();
    const transcript = (data.text || "").trim();

    return Response.json({
      ok: true,
      transcript,
    });
  } catch (err: any) {
    console.error("[Audio Transcribe] Unexpected error:", err);
    return jsonError("Internal error processing speech recording", 500);
  }
}
