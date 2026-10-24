"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Square, Check, X, Loader2, Volume2 } from "lucide-react";
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const speechHandleRef = useRef<{ stop: () => void } | null>(null);
  const accumulatedFinalRef = useRef<string>("");
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up all active audio resources safely
  const cleanupAudioStreams = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
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

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }

    if (activeStreamRef.current) {
      try {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      activeStreamRef.current = null;
    }

    isListeningRef.current = false;
    setIsListening(false);
  }, []);

  // Stop listening and process audio transcript
  const finishListening = useCallback(async () => {
    const speechFinal = (accumulatedFinalRef.current || "").trim();
    const interimSnapshot = (interimText || "").trim();
    const capturedViaWebSpeech = speechFinal || interimSnapshot;

    cleanupAudioStreams();
    setInterimText("");
    accumulatedFinalRef.current = "";

    // If Web Speech API captured spoken text, use it directly
    if (capturedViaWebSpeech) {
      onTranscriptReady(capturedViaWebSpeech);
      return;
    }

    // Otherwise, fall back to backend Whisper transcription using recorded audio chunks
    const chunks = audioChunksRef.current;
    if (chunks.length > 0) {
      const mimeType = chunks[0]?.type || "audio/webm";
      const audioBlob = new Blob(chunks, { type: mimeType });

      if (audioBlob.size > 500) {
        setIsTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", audioBlob, "voice-input.webm");
          form.append("language", language);

          const res = await fetch("/api/audio/transcribe", {
            method: "POST",
            body: form,
          });

          if (res.ok) {
            const data = await res.json();
            const transcript = (data.transcript || "").trim();
            if (transcript) {
              onTranscriptReady(transcript);
              return;
            }
          }
        } catch (transcribeErr) {
          console.warn("[VoiceInput] Server transcription fallback error:", transcribeErr);
        } finally {
          setIsTranscribing(false);
        }
      }
    }

    toast.info("No speech detected. Please speak into your microphone and click Done.");
  }, [cleanupAudioStreams, interimText, language, onTranscriptReady]);

  // Cancel listening and discard input
  const cancelListening = useCallback(() => {
    cleanupAudioStreams();
    setInterimText("");
    accumulatedFinalRef.current = "";
    audioChunksRef.current = [];
    onInterimTranscript?.("");
  }, [cleanupAudioStreams, onInterimTranscript]);

  // Start Voice Input session
  const startListening = useCallback(async () => {
    if (typeof window === "undefined") return;

    // Stop active audio read-aloud
    if (speechHandleRef.current) {
      speechHandleRef.current.stop();
      speechHandleRef.current = null;
      setIsSpeaking(false);
    }

    cleanupAudioStreams();
    audioChunksRef.current = [];
    accumulatedFinalRef.current = "";
    setInterimText("");
    setRecordingSeconds(0);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      activeStreamRef.current = stream;
    } catch (err: any) {
      console.warn("[VoiceInput] Microphone permission/access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Microphone access blocked. Please enable microphone permissions in your browser.");
      } else {
        toast.error("Could not access microphone hardware. Please check your audio settings.");
      }
      return;
    }

    isListeningRef.current = true;
    setIsListening(true);

    // 1. Initialize MediaRecorder on the live microphone stream
    try {
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(250); // Collect chunk every 250ms
    } catch (recorderErr) {
      console.warn("[VoiceInput] MediaRecorder initialization warning:", recorderErr);
    }

    // Start elapsed seconds timer
    const startTime = Date.now();
    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 500);

    // 2. Initialize Web Speech Recognition in parallel for real-time live preview
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        if (language === "te") {
          recognition.lang = "te-IN";
        } else if (language === "hi") {
          recognition.lang = "hi-IN";
        } else {
          recognition.lang = "en-IN";
        }

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
            ? accumulatedFinalRef.current + (currentInterim ? ` ${currentInterim}` : "")
            : currentInterim;

          if (display) {
            setInterimText(display);
            onInterimTranscript?.(display);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("[VoiceInput] Speech recognition event error:", event.error);
          // If Web Speech errors out (e.g. network/no-speech), audio recording is still capturing via MediaRecorder!
        };

        recognition.onend = () => {
          // If user is still actively recording, restart speech recognition to keep live preview going
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognition.start();
            } catch {
              // ignore
            }
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (recErr) {
        console.warn("[VoiceInput] Web Speech API start warning:", recErr);
      }
    }
  }, [cleanupAudioStreams, language, onInterimTranscript]);

  // Handle read-aloud for assistant responses
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
      cleanupAudioStreams();
      if (speechHandleRef.current) {
        speechHandleRef.current.stop();
      }
    };
  }, [cleanupAudioStreams]);

  return (
    <div className="flex items-center gap-2">
      {/* 1. Active Recording Mode */}
      {isListening ? (
        <div className="flex items-center gap-2 bg-red-50 border border-red-300 px-3 py-1.5 rounded-xl animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
            </span>
            <span className="text-xs font-mono font-bold text-red-700">
              {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
            </span>
            <span className="text-xs font-semibold text-red-900 max-w-[180px] sm:max-w-xs truncate">
              {interimText || "Listening... speak now"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 ml-1 border-l border-red-200 pl-2">
            <button
              type="button"
              onClick={finishListening}
              title="Finish speaking and send query"
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
            <button
              type="button"
              onClick={cancelListening}
              title="Cancel voice input"
              className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : isTranscribing ? (
        /* 2. Audio Processing Spinner */
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl">
          <Loader2 className="w-4 h-4 animate-spin text-[#087F8C]" />
          <span className="text-xs font-semibold text-[#087F8C]">Transcribing voice...</span>
        </div>
      ) : isSpeaking ? (
        /* 3. Stop Audio Playback Button */
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
        /* 4. Default Idle Microphone Button */
        <button
          type="button"
          onClick={startListening}
          disabled={isProcessing}
          title={`Click to speak in ${language === "te" ? "Telugu" : language === "hi" ? "Hindi" : "English"}`}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
            isProcessing
              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              : "bg-teal-50 hover:bg-teal-100 text-[#087F8C] border-teal-200 shadow-xs active:scale-95 hover:border-teal-300"
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
