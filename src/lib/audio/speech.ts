/**
 * Speech Synthesis & Audio Engine for AyuvSaathi Health Assistant.
 * Built with resilience for Chromium on Windows, multi-lingual voice selection
 * (English, Telugu, Hindi), sentence chunking, and markdown cleaning.
 */

export function cleanTextForSpeech(raw: string): string {
  if (!raw) return "";

  return raw
    // Remove markdown code blocks & inline code
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    // Remove markdown headings & formatting
    .replace(/#{1,6}\s+/g, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    // Remove links
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    // Replace bullet points & list markers
    .replace(/^\s*[-*•+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    // Normalize medical abbreviations for spoken clarity (both with space and attached to digits)
    .replace(/(\d+)\s*mg\b/gi, "$1 milligrams")
    .replace(/\bmg\b/gi, "milligrams")
    .replace(/(\d+)\s*ml\b/gi, "$1 milliliters")
    .replace(/\bml\b/gi, "milliliters")
    .replace(/(\d+)\s*mc?g\b/gi, "$1 micrograms")
    .replace(/\bmc?g\b/gi, "micrograms")
    .replace(/\btab\.?\b/gi, "tablet")
    .replace(/\bcap\.?\b/gi, "capsule")
    .replace(/\bOD\b/g, "once daily")
    .replace(/\bBD\b/g, "twice daily")
    .replace(/\bTDS\b/g, "three times daily")
    .replace(/\bSOS\b/g, "as needed")
    // Clean excessive whitespaces & special characters
    .replace(/[<>{}[\]|\\^~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split long text into manageable chunks (< 160 characters) at natural sentence breaks.
 * This prevents the Chromium / Windows SAPI speech synthesis freeze on long utterances.
 */
export function splitIntoSentences(text: string): string[] {
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return [];

  // Match sentences ending in punctuation or clause breaks
  const rawSegments = cleaned.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [cleaned];
  const chunks: string[] = [];

  for (const seg of rawSegments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;

    if (trimmed.length <= 160) {
      chunks.push(trimmed);
    } else {
      // Further subdivide by commas or word boundaries if still too long
      const parts = trimmed.split(/,\s+/);
      let current = "";
      for (const part of parts) {
        if ((current + ", " + part).length <= 160) {
          current = current ? current + ", " + part : part;
        } else {
          if (current) chunks.push(current);
          current = part;
        }
      }
      if (current) chunks.push(current);
    }
  }

  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * Find the best matching browser voice for the selected language.
 */
export function getBestVoice(voices: SpeechSynthesisVoice[], language: string): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const lang = language.toLowerCase();

  // 1. Telugu (te, te-IN)
  if (lang === "te" || lang.startsWith("te")) {
    const teluguVoice = voices.find((v) => v.lang.toLowerCase().startsWith("te"));
    if (teluguVoice) return teluguVoice;
  }

  // 2. Hindi (hi, hi-IN)
  if (lang === "hi" || lang.startsWith("hi")) {
    const hindiVoice = voices.find((v) => v.lang.toLowerCase().startsWith("hi"));
    if (hindiVoice) return hindiVoice;
  }

  // 3. Indian English preferred, then general English
  const indianEnglish = voices.find((v) => v.lang.toLowerCase().includes("en-in"));
  if (indianEnglish) return indianEnglish;

  const englishVoice = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  if (englishVoice) return englishVoice;

  return voices[0] || null;
}

export interface SpeakOptions {
  language?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
  onSentenceChange?: (index: number, total: number) => void;
}

/**
 * Speak text safely with sentence chaining, Chromium pause-bug defense,
 * and voice selection.
 */
export function speakText(text: string, options: SpeakOptions = {}): { stop: () => void } {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    options.onError?.(new Error("Speech synthesis not supported in this browser environment"));
    return { stop: () => {} };
  }

  // Cancel any active speech
  window.speechSynthesis.cancel();

  const chunks = splitIntoSentences(text);
  if (chunks.length === 0) {
    options.onEnd?.();
    return { stop: () => {} };
  }

  const language = options.language || "en";
  let voices = window.speechSynthesis.getVoices();
  let bestVoice = getBestVoice(voices, language);

  let isStopped = false;
  let currentIndex = 0;
  let keepAliveTimer: NodeJS.Timeout | null = null;

  // Active utterance reference to prevent Chromium garbage collection abort
  let currentUtterance: SpeechSynthesisUtterance | null = null;

  const cleanup = () => {
    isStopped = true;
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
    currentUtterance = null;
    if (typeof window !== "undefined") {
      delete (window as any).__ayuvActiveUtterance;
    }
  };

  const stop = () => {
    cleanup();
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    options.onEnd?.();
  };

  // Chromium keep-alive: Chromium speech synthesis pauses after 15s unless resumed
  keepAliveTimer = setInterval(() => {
    if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, 3000);

  const speakNext = () => {
    if (isStopped || currentIndex >= chunks.length) {
      cleanup();
      options.onEnd?.();
      return;
    }

    const chunk = chunks[currentIndex];
    const utterance = new SpeechSynthesisUtterance(chunk);
    currentUtterance = utterance;
    if (typeof window !== "undefined") {
      (window as any).__ayuvActiveUtterance = currentUtterance;
    }

    // Refresh voices if they loaded late
    if (!bestVoice) {
      voices = window.speechSynthesis.getVoices();
      bestVoice = getBestVoice(voices, language);
    }

    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    // Set locale language tag
    if (language === "te") {
      utterance.lang = "te-IN";
    } else if (language === "hi") {
      utterance.lang = "hi-IN";
    } else {
      utterance.lang = "en-IN";
    }

    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;

    utterance.onstart = () => {
      if (currentIndex === 0) {
        options.onStart?.();
      }
      options.onSentenceChange?.(currentIndex, chunks.length);
    };

    utterance.onend = () => {
      currentIndex++;
      speakNext();
    };

    utterance.onerror = (e) => {
      // Interrupted/canceled occurs on stop()
      if (e.error === "interrupted" || e.error === "canceled") {
        cleanup();
        return;
      }
      console.warn("[SpeechSynthesis] Chunk error:", e);
      currentIndex++;
      speakNext();
    };

    try {
      // Resume prior to speak to unpause Chrome Windows audio engine
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("[SpeechSynthesis] Speak call failed:", err);
      options.onError?.(err);
      cleanup();
    }
  };

  // If voices aren't populated yet, wait for voiceschanged
  if (voices.length === 0 && "onvoiceschanged" in window.speechSynthesis) {
    const handleVoicesChanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      voices = window.speechSynthesis.getVoices();
      bestVoice = getBestVoice(voices, language);
      speakNext();
    };
    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    // Fallback timeout in case onvoiceschanged never fires
    setTimeout(() => {
      if (currentIndex === 0 && !isStopped) {
        speakNext();
      }
    }, 150);
  } else {
    speakNext();
  }

  return { stop };
}
