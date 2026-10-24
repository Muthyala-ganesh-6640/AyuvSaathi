"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Square, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { speakText } from "@/lib/audio/speech";

interface VoiceInputProps {
  onTranscriptReady: (transcript: string) => void;
  language?: string;
  isProcessing?: boolean;
  assistantResponseToSpeak?: string | null;
  onInterimTranscript?: (interim: string) => void;
  autoSpeakResponses?: boolean;
}

export function VoiceInput({
  onTranscriptReady,
  language = "en",
  isProcessing = false,
  assistantResponseToSpeak = null,
  onInterimTranscript,
  autoSpeakResponses = false,
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechHandleRef = useRef<{ stop: () => void } | null>(null);
  const accumulatedFinalRef = useRef<string>("");

  // Check browser support on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasSpeechRec =
        Boolean((window as any).SpeechRecognition) ||
        Boolean((window as any).webkitSpeechRecognition);
      setSupported(hasSpeechRec);
    }
  }, []);

  // Stop listening cleanly
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    setIsListening(false);
  }, []);

  // Commit transcript when user is done speaking
  const commitTranscript = useCallback(() => {
    const fullText = accumulatedFinalRef.current.trim() || interimText.trim();
    stopListening();
    setInterimText("");
    accumulatedFinalRef.current = "";

    if (fullText) {
      onTranscriptReady(fullText);
    } else {
      toast.info("No speech detected. Please speak closer to the microphone and try again.");
    }
  }, [interimText, onTranscriptReady, stopListening]);

  // Cancel listening and discard input
  const cancelListening = useCallback(() => {
    stopListening();
    setInterimText("");
    accumulatedFinalRef.current = "";
    onInterimTranscript?.("");
  }, [stopListening, onInterimTranscript]);

  // Start fresh SpeechRecognition session
  const startListening = useCallback(async () => {
    if (typeof window === "undefined") return;

    // Stop any playing speech before listening
    if (speechHandleRef.current) {
      speechHandleRef.current.stop();
      speechHandleRef.current = null;
      setIsSpeaking(false);
    }

    const SpeechRecConstructor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecConstructor) {
      toast.info("Voice dictation is supported in Google Chrome, Microsoft Edge, and modern browsers.");
      return;
    }

    // Check / request mic permission explicitly
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Release tracks immediately
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch (permErr: any) {
      console.warn("Microphone access error:", permErr);
      if (permErr.name === "NotAllowedError" || permErr.name === "PermissionDeniedError") {
        toast.error("Microphone permission denied. Please allow microphone access in your browser settings.");
        return;
      }
    }

    try {
      stopListening();

      const recognition = new SpeechRecConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Select proper language code
      if (language === "te") {
        recognition.lang = "te-IN";
      } else if (language === "hi") {
        recognition.lang = "hi-IN";
      } else {
        recognition.lang = "en-IN";
      }

      accumulatedFinalRef.current = "";
      setInterimText("");

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            accumulatedFinalRef.current += (accumulatedFinalRef.current ? " " : "") + piece.trim();
          } else {
            currentInterim += piece;
          }
        }

        const display = accumulatedFinalRef.current
          ? accumulatedFinalRef.current + (currentInterim ? ` (${currentInterim})` : "")
          : currentInterim;

        setInterimText(display);
        onInterimTranscript?.(display);

        // Reset silence timer on new voice activity (auto-commit after 2.5s silence)
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          commitTranscript();
        }, 2500);
      };

      recognition.onerror = (event: any) => {
        console.warn("[VoiceInput] Speech error:", event.error);
        if (event.error === "not-allowed") {
          toast.error("Microphone permission blocked. Please enable microphone permissions in your browser URL bar.");
          stopListening();
        } else if (event.error === "network") {
          toast.error("Network error during speech recognition. Check your connection.");
          stopListening();
        } else if (event.error !== "no-speech") {
          toast.error(`Speech recognition: ${event.error}`);
          stopListening();
        }
      };

      recognition.onend = () => {
        // If still listening and has text, commit it
        if (accumulatedFinalRef.current.trim()) {
          commitTranscript();
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn("[VoiceInput] Start error:", err);
      toast.error("Could not activate voice input. Please try again.");
      stopListening();
    }
  }, [language, onInterimTranscript, stopListening, commitTranscript]);

  // Handle auto-speak for assistant responses
  useEffect(() => {
    if (autoSpeakResponses && assistantResponseToSpeak) {
      if (speechHandleRef.current) {
        speechHandleRef.current.stop();
      }

      speechHandleRef.current = speakText(assistantResponseToSpeak, {
        language,
        onStart: () => setIsSpeaking(true),
        onEnd: () => {
          setIsSpeaking(false);
          speechHandleRef.current = null;
        },
        onError: () => {
          setIsSpeaking(false);
          speechHandleRef.current = null;
        },
      });
    }

    return () => {
      if (speechHandleRef.current) {
        speechHandleRef.current.stop();
        speechHandleRef.current = null;
      }
    };
  }, [assistantResponseToSpeak, autoSpeakResponses, language]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (speechHandleRef.current) {
        speechHandleRef.current.stop();
      }
    };
  }, [stopListening]);

  return (
    <div className="flex items-center gap-2">
      {/* Listening State with Live Waves & Done Button */}
      {isListening ? (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-semibold text-red-700 max-w-[200px] sm:max-w-xs truncate">
              {interimText || "Listening (speak now)..."}
            </span>
          </div>

          <div className="flex items-center gap-1 ml-1 border-l border-red-200 pl-2">
            <button
              type="button"
              onClick={commitTranscript}
              title="Done speaking (Send query)"
              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={cancelListening}
              title="Cancel voice input"
              className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : isSpeaking ? (
        <button
          type="button"
          onClick={() => {
            if (speechHandleRef.current) {
              speechHandleRef.current.stop();
              speechHandleRef.current = null;
              setIsSpeaking(false);
            }
          }}
          title="Stop reading response"
          className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold animate-pulse"
        >
          <Square className="w-4 h-4 fill-current" />
          <span className="hidden sm:inline">Stop Audio</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={startListening}
          disabled={isProcessing}
          title={
            supported
              ? `Speak query in ${language === "te" ? "Telugu" : language === "hi" ? "Hindi" : "English"}`
              : "Voice input (Supported in Chrome/Edge)"
          }
          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
            isProcessing
              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              : "bg-teal-50 hover:bg-teal-100 text-[#087F8C] border-teal-200 shadow-xs active:scale-95"
          }`}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : (
            <Mic className="w-5 h-5 text-[#087F8C]" />
          )}
        </button>
      )}
    </div>
  );
}
