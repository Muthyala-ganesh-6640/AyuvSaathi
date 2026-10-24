"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState, useRef } from "react";
import { VoiceInput } from "@/components/assistant/VoiceInput";
import {
  Bot,
  Send,
  User,
  ShieldAlert,
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleSend = async (questionText?: string) => {
    const textToSend = questionText || input;
    if (!textToSend.trim() || loading) return;

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
        setSpokenResponse(data.message.content);
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#DDF5F0] text-[#087F8C]">
                <Bot className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#17344F] tracking-tight">
                {t("title")}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#61768A]">
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* Clinical Guardrail Callout */}
        <div className="p-4 bg-[#EFF9F5] border border-teal-100 rounded-xl flex items-start gap-3 text-xs text-[#17344F]">
          <ShieldAlert className="w-4 h-4 text-[#087F8C] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {t("caution")}
          </p>
        </div>

        {/* Chat History Box */}
        <div className="flex-1 bg-white rounded-xl border border-[#E1EBF0] shadow-xs p-5 sm:p-6 flex flex-col justify-between space-y-4 min-h-[400px]">
          <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1">
            {messages.length === 0 ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#087F72] border border-teal-200 mx-auto flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#172B3A]">
                    {t("title")}
                  </h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
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
                      className="px-3.5 py-2 rounded-xl bg-gray-50 hover:bg-teal-50 border border-gray-200 hover:border-teal-200 text-xs text-gray-700 hover:text-[#087F72] font-medium transition-colors text-left cursor-pointer"
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
                    <div className="w-8 h-8 rounded-xl bg-[#DDF5F0] text-[#087F8C] border border-teal-200 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`p-4 rounded-xl max-w-xl text-xs sm:text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#087F8C] text-white rounded-br-xs shadow-xs"
                        : "bg-[#F7FAFC] border border-[#E1EBF0] text-[#17344F] rounded-bl-xs"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>

                  {m.role === "user" && (
                    <div className="w-8 h-8 rounded-xl bg-[#DDF5F0] text-[#087F8C] border border-teal-200 flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))
            )}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-xl bg-[#DDF5F0] text-[#087F8C] border border-teal-200 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-3.5 rounded-xl bg-[#F7FAFC] border border-[#E1EBF0] text-[#61768A] text-xs italic">
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
            className="pt-3 border-t border-[#E9F0F3] flex items-center gap-2"
          >
            <VoiceInput
              language={locale}
              isProcessing={loading}
              assistantResponseToSpeak={spokenResponse}
              onTranscriptReady={(transcript) => handleSend(transcript)}
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("inputPlaceholder")}
              className="flex-1 px-4 py-3 rounded-xl border border-[#E1EBF0] focus:border-[#087F8C] focus:ring-1 focus:ring-[#087F8C] outline-hidden text-xs sm:text-sm bg-white"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 py-3 rounded-xl bg-[#087F8C] hover:bg-[#07545B] text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">{t("send")}</span>
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
