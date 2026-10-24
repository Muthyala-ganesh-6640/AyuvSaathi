"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState, useRef, useCallback } from "react";
import { VoiceInput } from "@/components/assistant/VoiceInput";
import { speakText } from "@/lib/audio/speech";
import {
  Bot,
  Send,
  User,
  ShieldAlert,
  Volume2,
  VolumeX,
  Square,
} from "lucide-react";
import { toast } from "sonner";

interface MessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sourceRefs: string[];
  createdAt: string;
}

export default function AssistantPage() {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const router = useRouter();

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [spokenResponse, setSpokenResponse] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeSpeechHandleRef = useRef<{ stop: () => void } | null>(null);

  const sampleQuestions = [
    t("sampleQuestion1"),
    t("sampleQuestion2"),
    t("sampleQuestion3"),
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clean up any speech synthesis when component unmounts
  useEffect(() => {
    return () => {
      if (activeSpeechHandleRef.current) {
        activeSpeechHandleRef.current.stop();
        activeSpeechHandleRef.current = null;
      }
    };
  }, []);

  // Stop current speech
  const stopCurrentSpeech = useCallback(() => {
    if (activeSpeechHandleRef.current) {
      activeSpeechHandleRef.current.stop();
      activeSpeechHandleRef.current = null;
    }
    setSpeakingMsgId(null);
  }, []);

  // Play / Stop a specific message audio
  const toggleSpeakMessage = useCallback(
    (msgId: string, content: string) => {
      if (speakingMsgId === msgId) {
        stopCurrentSpeech();
        return;
      }

      stopCurrentSpeech();
      setSpeakingMsgId(msgId);

      activeSpeechHandleRef.current = speakText(content, {
        language: locale,
        onStart: () => setSpeakingMsgId(msgId),
        onEnd: () => {
          setSpeakingMsgId(null);
          activeSpeechHandleRef.current = null;
        },
        onError: () => {
          setSpeakingMsgId(null);
          activeSpeechHandleRef.current = null;
          toast.error("Audio playback encountered an issue in browser");
        },
      });
    },
    [locale, speakingMsgId, stopCurrentSpeech]
  );

  const handleSend = async (questionText?: string, fromVoice = false) => {
    const textToSend = questionText || input;
    if (!textToSend.trim() || loading) return;

    // If query originated from microphone, enable read-aloud for response
    if (fromVoice) {
      setAutoSpeak(true);
    }

    // Stop existing speech before generating new response
    stopCurrentSpeech();

    const userMsg: MessageItem = {
      id: crypto.randomUUID(),
      role: "user",
      content: textToSend.trim(),
      sourceRefs: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          message: textToSend.trim(),
          language: locale,
        }),
      });

      if (res.status === 401) {
        router.push("/auth/sign-in");
        return;
      }

      const data = await res.json();
      if (res.ok && data.message) {
        if (!conversationId && data.conversationId) {
          setConversationId(data.conversationId);
        }
        setMessages((prev) => [...prev, data.message]);

        // Trigger read aloud if voice mode is on or user spoke the query
        if (fromVoice || autoSpeak) {
          setSpokenResponse(data.message.content);
          toggleSpeakMessage(data.message.id, data.message.content);
        }
      } else {
        setMessages((prev) => prev.filter((message) => message.id !== userMsg.id));
        toast.error(data.error || "Could not generate response");
      }
    } catch {
      setMessages((prev) => prev.filter((message) => message.id !== userMsg.id));
      toast.error("Network error during assistant communication");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 py-2 max-w-4xl mx-auto flex-1 flex flex-col min-h-[calc(100vh-14rem)]">
        {/* Navy & Gold Hero Header */}
        <div className="bg-gradient-to-r from-[#08193C] via-[#0C2353] to-[#08193C] rounded-2xl p-5 sm:p-6 text-white shadow-md border border-[#D4E1EE]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="p-2 rounded-xl bg-white/10 border border-[#DDB549]/30 text-[#DDB549] shadow-xs">
                <Bot className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {t("title")}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#D4E1EE]">
              {t("subtitle")}
            </p>
          </div>

          {/* Voice Mode Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = !autoSpeak;
                setAutoSpeak(next);
                if (!next) stopCurrentSpeech();
                toast.info(`Voice Read-Aloud ${next ? "Enabled (Responses will be read aloud)" : "Disabled"}`);
              }}
              className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-[#DDB549] ${
                autoSpeak
                  ? "bg-[#DDB549] text-[#08193C] border-[#DDB549] font-bold"
                  : "bg-white/10 text-white border-white/20 hover:bg-white/20"
              }`}
              title="Toggle automatic speech read-aloud for assistant answers"
            >
              {autoSpeak ? (
                <>
                  <Volume2 className="w-4 h-4 text-[#08193C] animate-pulse" />
                  <span>Voice Mode: ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-[#D4E1EE]" />
                  <span>Voice Mode: OFF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Clinical Guardrail Callout */}
        <div className="p-4 bg-[#EDF3F7] border border-[#D4E1EE] rounded-xl flex items-start gap-3 text-xs text-[#08193C]">
          <ShieldAlert className="w-4 h-4 text-[#DDB549] shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[#465978]">
            {t("caution")}
          </p>
        </div>

        {/* Chat History Box */}
        <div className="flex-1 bg-white rounded-2xl border border-[#D4E1EE] shadow-xs p-5 sm:p-6 flex flex-col justify-between space-y-4 min-h-[440px]">
          <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1">
            {messages.length === 0 ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#08193C] text-[#DDB549] border border-[#D4E1EE] mx-auto flex items-center justify-center shadow-xs">
                  <Bot className="w-7 h-7 text-[#DDB549]" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#08193C]">
                    {t("title")}
                  </h3>
                  <p className="text-xs text-[#465978] max-w-md mx-auto mt-1">
                    {t("subtitle")}
                  </p>
                </div>

                {/* Sample Starter Chips */}
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {sampleQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(q)}
                      className="px-3.5 py-2 rounded-xl bg-[#EDF3F7] hover:bg-[#08193C] border border-[#D4E1EE] hover:border-[#08193C] text-xs text-[#08193C] hover:text-white font-medium transition-all text-left cursor-pointer shadow-2xs"
                    >
                      &ldquo;{q}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <div className="w-8 h-8 rounded-xl bg-[#08193C] text-[#DDB549] flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                      <Bot className="w-4 h-4 text-[#DDB549]" />
                    </div>
                  )}

                  <div
                    className={`p-4 rounded-2xl max-w-xl text-xs sm:text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#08193C] text-white rounded-br-xs shadow-xs"
                        : "bg-[#EDF3F7] border border-[#D4E1EE] text-[#08193C] rounded-bl-xs"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>

                    {/* Assistant Read Aloud Button */}
                    {m.role === "assistant" && (
                      <div className="mt-3 pt-2.5 border-t border-[#D4E1EE] flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => toggleSpeakMessage(m.id, m.content)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                            speakingMsgId === m.id
                              ? "bg-[#08193C] text-[#DDB549] border border-[#DDB549]"
                              : "bg-white hover:bg-[#EDF3F7] text-[#08193C] border border-[#D4E1EE]"
                          }`}
                          title="Listen to this explanation"
                        >
                          {speakingMsgId === m.id ? (
                            <>
                              <Square className="w-3.5 h-3.5 fill-current text-[#DDB549]" />
                              <span className="font-semibold text-[#DDB549]">Stop Reading</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-[#08193C]" />
                              <span>Read Aloud</span>
                            </>
                          )}
                        </button>

                        {speakingMsgId === m.id && (
                          <span className="flex items-center gap-1 text-[11px] text-[#08193C] font-semibold animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-[#DDB549] animate-ping" />
                            AyuvSaathi is speaking...
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {m.role === "user" && (
                    <div className="w-8 h-8 rounded-xl bg-[#EDF3F7] text-[#08193C] border border-[#D4E1EE] flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                      <User className="w-4 h-4 text-[#08193C]" />
                    </div>
                  )}
                </div>
              ))
            )}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-xl bg-[#08193C] text-[#DDB549] flex items-center justify-center shrink-0 shadow-2xs">
                  <Bot className="w-4 h-4 text-[#DDB549]" />
                </div>
                <div className="p-3.5 rounded-xl bg-[#EDF3F7] border border-[#D4E1EE] text-[#465978] text-xs italic">
                  Analyzing confirmed records and formulating safe explanation...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="pt-3 border-t border-[#D4E1EE] flex items-center gap-2"
          >
            <VoiceInput
              language={locale}
              isProcessing={loading}
              assistantResponseToSpeak={spokenResponse}
              autoSpeakResponses={autoSpeak}
              onInterimTranscript={(interim) => {
                if (interim) {
                  setInput(interim);
                }
              }}
              onTranscriptReady={(transcript) => {
                setInput(transcript);
                handleSend(transcript, true);
              }}
            />

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("inputPlaceholder")}
              className="flex-1 px-4 py-3 rounded-xl border border-[#D4E1EE] focus:border-[#08193C] focus:ring-2 focus:ring-[#DDB549]/30 outline-hidden text-xs sm:text-sm bg-[#FDFEFE] text-[#08193C] placeholder:text-[#9AA5B4]"
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 py-3 rounded-xl bg-[#08193C] hover:bg-[#122958] text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[#DDB549]"
            >
              <Send className="w-4 h-4 text-[#DDB549]" />
              <span className="hidden sm:inline">{t("send")}</span>
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
