"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, Square, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface VoiceInputProps {
  onTranscriptReady: (transcript: string) => void;
  language?: string;
  isProcessing?: boolean;
  assistantResponseToSpeak?: string | null;
}

export function VoiceInput({
  onTranscriptReady,
  language = "en",
  isProcessing = false,
  assistantResponseToSpeak = null,
}: VoiceInputProps) {
  const [state, setState] = useState<"idle" | "listening" | "processing" | "speaking">("idle");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check speech recognition support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      // Set recognition language
      if (language === "te") {
        recognition.lang = "te-IN";
      } else if (language === "hi") {
        recognition.lang = "hi-IN";
      } else {
        recognition.lang = "en-IN";
      }

      recognition.onstart = () => {
        setState("listening");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setState("idle");
          onTranscriptReady(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setState("idle");
        if (event.error !== "no-speech") {
          toast.error(`Voice recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        if (state === "listening") {
          setState("idle");
        }
      };

      recognitionRef.current = recognition;
    } catch (err) {
      setSupported(false);
    }
  }, [language]);

  // Handle external processing state
  useEffect(() => {
    if (isProcessing) {
      setState("processing");
    } else if (state === "processing") {
      setState("idle");
    }
  }, [isProcessing]);

  // Handle Text-To-Speech for assistant responses
  useEffect(() => {
    if (assistantResponseToSpeak && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      // Strip markdown asterisks and URLs for cleaner speech
      const cleanText = assistantResponseToSpeak.replace(/[*_#`]/g, "").slice(0, 300);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      if (language === "te") utterance.lang = "te-IN";
      else if (language === "hi") utterance.lang = "hi-IN";
      else utterance.lang = "en-IN";

      utterance.onstart = () => setState("speaking");
      utterance.onend = () => setState("idle");
      utterance.onerror = () => setState("idle");

      window.speechSynthesis.speak(utterance);
    }
  }, [assistantResponseToSpeak, language]);

  const toggleListening = () => {
    if (!supported) {
      toast.info("Voice input is not supported by your browser. Please type your query.");
      return;
    }

    if (state === "speaking") {
      window.speechSynthesis.cancel();
      setState("idle");
      return;
    }

    if (state === "listening") {
      recognitionRef.current?.stop();
      setState("idle");
    } else {
      try {
        recognitionRef.current?.start();
      } catch (err) {
        // Recognition might already be running
        recognitionRef.current?.stop();
        setState("idle");
      }
    }
  };

  const getStatusText = () => {
    switch (state) {
      case "listening":
        return "Listening to your health query...";
      case "processing":
        return "Analyzing your medical context...";
      case "speaking":
        return "AyuvSaathi is reading response...";
      default:
        return "Tap mic to speak (EN / TE / HI)";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleListening}
        className={`relative p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
          state === "listening"
            ? "bg-red-500 text-white shadow-lg animate-pulse scale-105"
            : state === "speaking"
            ? "bg-blue-600 text-white shadow-md animate-bounce"
            : state === "processing"
            ? "bg-amber-100 text-amber-800"
            : "bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200"
        }`}
        title={getStatusText()}
      >
        {state === "listening" ? (
          <Mic className="w-5 h-5 animate-pulse" />
        ) : state === "speaking" ? (
          <Volume2 className="w-5 h-5 animate-spin" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>

      {state !== "idle" && (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700 animate-in fade-in">
          <span
            className={`w-2 h-2 rounded-full ${
              state === "listening"
                ? "bg-red-500 animate-ping"
                : state === "speaking"
                ? "bg-blue-500"
                : "bg-amber-500"
            }`}
          />
          <span>{getStatusText()}</span>
        </div>
      )}
    </div>
  );
}
