import { describe, it, expect } from "vitest";
import { cleanTextForSpeech, splitIntoSentences, getBestVoice } from "@/lib/audio/speech";

describe("Voice Assistant Audio & Speech Engine", () => {
  it("cleans markdown and technical formatting for natural speech", () => {
    const rawMarkdown = `
# Medical Summary
Your **Hemoglobin** level is **13.5 g/dL**.
Take *Paracetamol* 500mg tab OD with water.
- Consult your doctor if fever persists.
[Click for details](https://example.com)
\`\`\`code block\`\`\`
    `;

    const cleaned = cleanTextForSpeech(rawMarkdown);
    expect(cleaned).not.toContain("#");
    expect(cleaned).not.toContain("**");
    expect(cleaned).not.toContain("*");
    expect(cleaned).not.toContain("```");
    expect(cleaned).not.toContain("https://example.com");
    expect(cleaned).toContain("500 milligrams tablet once daily");
    expect(cleaned).toContain("Hemoglobin level is 13.5 g/dL");
  });

  it("splits long text into sentence chunks under 160 characters", () => {
    const longMedicalText =
      "Your lipid profile tests show an elevated total cholesterol of 230 milligrams per deciliter, with LDL cholesterol at 145 milligrams per deciliter, which requires dietary modifications and physical exercise. Your HDL remains healthy at 55 milligrams per deciliter. Please discuss starting low-dose statin therapy with your physician during your next consultation visit.";

    const chunks = splitIntoSentences(longMedicalText);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(165);
    }
  });

  it("selects appropriate voices for English, Hindi, and Telugu", () => {
    const mockVoices = [
      { name: "Google US English", lang: "en-US" },
      { name: "Google Indian English", lang: "en-IN" },
      { name: "Google Hindi", lang: "hi-IN" },
      { name: "Google Telugu", lang: "te-IN" },
    ] as SpeechSynthesisVoice[];

    const enVoice = getBestVoice(mockVoices, "en");
    expect(enVoice?.lang).toBe("en-IN");

    const hiVoice = getBestVoice(mockVoices, "hi");
    expect(hiVoice?.lang).toBe("hi-IN");

    const teVoice = getBestVoice(mockVoices, "te");
    expect(teVoice?.lang).toBe("te-IN");
  });
});
