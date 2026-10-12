import { afterEach, describe, expect, it, vi } from "vitest";

describe("AI provider configuration and request formatting", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("treats an API key alone as configured", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "");
    vi.stubEnv("AI_PROVIDER", "");
    vi.resetModules();

    const { isAiConfigured } = await import("@/lib/env");
    expect(isAiConfigured()).toBe(true);
  });

  it("sends a Bearer token and accepts fenced JSON responses", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "gpt-4o-mini");
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "```json\n{\"reply\":\"ok\",\"usedRecordIds\":[],\"caution\":true}\n```" } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { assistantReply } = await import("./provider");
    const result = await assistantReply({
      language: "en",
      question: "How are my labs?",
      history: [],
      records: "Hemoglobin 14.2 g/dL",
    });

    expect(result.reply).toBe("ok");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer test-key",
        }),
      }),
    );
  });

  it("uses the configured chat model and OpenAI-compatible base URL", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "qwen/qwen3.8-27b");
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("AI_BASE_URL", "https://api.groq.com/openai/v1");
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"reply":"Answer","usedRecordIds":[],"caution":false}' } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { assistantReply } = await import("./provider");
    const result = await assistantReply({
      language: "en",
      question: "What causes rain?",
      history: [],
      records: "",
    });

    expect(result.reply).toBe("Answer");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({
        body: expect.stringContaining('"model":"qwen/qwen3.8-27b"'),
      }),
    );
  });

  it("sends prescription images to vision and requests a translated summary", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "qwen/qwen3.8-27b");
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("AI_BASE_URL", "https://api.groq.com/openai/v1");
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                prescriptionSummary: "Take one tablet after meals.",
                translatedSummary: "भोजन के बाद एक गोली लें।",
                medications: [
                  {
                    name: "",
                    strength: null,
                    instructions: "Illegible dosage",
                    confidence: "low",
                  },
                  {
                    name: "Example medicine",
                    strength: null,
                    instructions: "One tablet after meals",
                    confidence: "high",
                  },
                ],
                overallConfidence: "medium",
              }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { extractPrescriptionFromImages } = await import("./provider");
    const result = await extractPrescriptionFromImages({
      images: [{ mimeType: "image/png", base64: "ZmFrZQ==" }],
      language: "hi",
    });

    expect(result.translatedSummary).toBe("भोजन के बाद एक गोली लें।");
    expect(result.documentType).toBe("prescription");
    expect(result.medications).toHaveLength(1);
    expect(result.medications[0].strength).toBe("");
    expect(result.medications[0].uncertain).toBe(true);
    expect(result.unreadableRegions).toContain(
      "A medicine name was not clear enough to transcribe.",
    );
    expect(result.notes).toContain(
      "The model did not provide a valid confidence score.",
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.messages[1].content[1].image_url.url).toBe(
      "data:image/png;base64,ZmFrZQ==",
    );
    expect(requestBody.messages[1].content[0].text).toContain("translate");
    expect(requestBody.messages[1].content[0].text).toContain("Hindi");
    expect(requestBody.max_tokens).toBe(900);
  });

  it("summarizes discharge documents from images without inventing missing details", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "qwen/qwen3.8-27b");
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("AI_BASE_URL", "https://api.groq.com/openai/v1");
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              documentType: "discharge_summary",
              dischargeSummary: "The document states discharge on 12 May. No diagnosis is clearly listed.",
              translatedSummary: "12 मई को डिस्चार्ज का उल्लेख है। निदान स्पष्ट रूप से सूचीबद्ध नहीं है।",
              notes: [],
            }),
          },
          finish_reason: "stop",
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { extractMedicalDocumentFromImages } = await import("./provider");
    const result = await extractMedicalDocumentFromImages({
      images: [{ mimeType: "image/png", base64: "ZmFrZQ==" }],
      language: "hi",
      documentType: "discharge_summary",
    });

    expect(result.documentType).toBe("discharge_summary");
    expect(result.dischargeSummary).toContain("12 May");
    expect(result.translatedSummary).toContain("12 मई");
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.messages[1].content[0].text).toContain("hospital discharge document");
    expect(requestBody.messages[1].content[0].text).toContain("do not guess");
  });

  it("keeps valid prescription data when model metadata exceeds schema limits", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "qwen/qwen3.8-27b");
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("AI_BASE_URL", "https://api.groq.com/openai/v1");
    vi.resetModules();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reportDate: "2025 ".repeat(20),
                  prescriptionSummary: "Take one tablet daily.",
                  translatedSummary: "Take one tablet daily.",
                  medications: [
                    {
                      name: "Example medicine",
                      strength: "1 mg",
                      instructions: "After food",
                    },
                  ],
                }),
              },
              finish_reason: "stop",
            },
          ],
        }),
      }),
    );

    const { extractPrescriptionFromImages } = await import("./provider");
    const result = await extractPrescriptionFromImages({
      images: [{ mimeType: "image/png", base64: "ZmFrZQ==" }],
      language: "en",
    });

    expect(result.reportDate).toBeUndefined();
    expect(result.prescriptionSummary).toBe("Take one tablet daily.");
    expect(result.medications[0].name).toBe("Example medicine");
    expect(result.notes).toContain(
      "Some text was too long to verify and was omitted.",
    );
  });

  it("includes the provider's safe error reason in server diagnostics", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "qwen/qwen3.8-27b");
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("AI_BASE_URL", "https://api.groq.com/openai/v1");
    vi.resetModules();

    const errorResponse = {
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: { code: "invalid_request", message: "invalid image dimensions" },
        }),
      clone() {
        return this;
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse));

    const { extractPrescriptionFromImages } = await import("./provider");
    await expect(
      extractPrescriptionFromImages({
        images: [{ mimeType: "image/png", base64: "ZmFrZQ==" }],
        language: "en",
      }),
    ).rejects.toThrow("AI_HTTP_400:invalid_request: invalid image dimensions");
  });

  it("does not accept a truncated prescription response", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "qwen/qwen3.8-27b");
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("AI_BASE_URL", "https://api.groq.com/openai/v1");
    vi.resetModules();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: { content: '{"documentType":"prescription"' },
              finish_reason: "length",
            },
          ],
        }),
      }),
    );

    const { extractPrescriptionFromImages } = await import("./provider");
    await expect(
      extractPrescriptionFromImages({
        images: [{ mimeType: "image/png", base64: "ZmFrZQ==" }],
        language: "en",
      }),
    ).rejects.toThrow("AI_RESPONSE_TRUNCATED");
  });
});
