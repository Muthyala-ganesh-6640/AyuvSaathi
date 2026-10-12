"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList,
  Printer,
  Copy,
  Plus,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface VisitSummaryItem {
  id: string;
  title: string;
  content: string;
  questions: string[];
  createdAt: string;
}

interface ConfirmedData {
  observations: { id: string; name: string; value: string; unit: string; referenceRange?: string }[];
  medications: { id: string; name: string; strength: string; instructions: string }[];
}

export default function DoctorSummaryPage() {
  const t = useTranslations("doctorSummary");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [visits, setVisits] = useState<VisitSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState<ConfirmedData>({ observations: [], medications: [] });

  // Creation modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("Upcoming Routine Checkup Checklist");
  const [notes, setNotes] = useState("");
  const [questions, setQuestions] = useState(
    "1. Should any of my recent test results be rechecked?\n2. Are my current medicine dosages working as intended?\n3. What dietary changes or exercise should I adopt?"
  );
  const [saving, setSaving] = useState(false);

  const fetchVisitsAndRecords = useCallback(async () => {
    try {
      const [visitsRes, dashRes, medsRes] = await Promise.all([
        fetch("/api/visits"),
        fetch("/api/dashboard"),
        fetch("/api/medications"),
      ]);

      if (visitsRes.status === 401) {
        router.push("/auth/sign-in");
        return;
      }

      if (visitsRes.ok) {
        const json = await visitsRes.json();
        setVisits(json.visits || []);
      }

      const obsList: ConfirmedData["observations"] = [];
      const medsList: ConfirmedData["medications"] = [];

      if (dashRes.ok) {
        const dashData = await dashRes.json();
        if (dashData.recentObservations) {
          obsList.push(...dashData.recentObservations);
        }
      }

      if (medsRes.ok) {
        const medsData = await medsRes.json();
        medsList.push(...(medsData.medications || []));
      }

      setConfirmed({ observations: obsList, medications: medsList });
    } catch {
      toast.error("Failed to load visit data");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchVisitsAndRecords();
  }, [fetchVisitsAndRecords]);

  const handleCreateSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      toast.error("Please enter a summary title.");
      return;
    }

    const qArray = questions
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          content: notes || "Compiled health records for doctor consultation.",
          questions: qArray,
        }),
      });
      if (res.ok) {
        toast.success("Visit checklist created!");
        setShowModal(false);
        setTitle("");
        setNotes("");
        fetchVisitsAndRecords();
      } else {
        toast.error("Failed to create checklist");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this doctor visit summary?")) return;
    try {
      const res = await fetch(`/api/visits/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Summary deleted");
        setVisits((prev) => prev.filter((v) => v.id !== id));
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleCopyText = (v: VisitSummaryItem) => {
    const text = `AYUVSAATHI: TREATMENT PLAN & DOCTOR VISIT CHECKLIST\nTitle: ${v.title}\nDate: ${formatDate(
      v.createdAt,
      locale
    )}\n\nNotes:\n${v.content}\n\nQuestions for Doctor:\n${v.questions.join("\n")}`;
    navigator.clipboard.writeText(text);
    toast.success("Summary copied to clipboard!");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#DDF5F0] text-[#087F8C]">
                <ClipboardList className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#17344F] tracking-tight">
                {t("title")}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#61768A]">
              {t("subtitle")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#087F8C] hover:bg-[#07545B] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> {t("createNew")}
          </button>
        </div>

        {/* Existing Summaries */}
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">{common("loading")}</div>
        ) : visits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-sm text-gray-500 space-y-3">
            <ClipboardList className="w-10 h-10 text-gray-400 mx-auto" />
            <p>{t("emptyVisits")}</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="text-[#087F72] font-semibold hover:underline inline-block text-xs"
            >
              + Create your first doctor consultation summary
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {visits.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
                  <div>
                    <h3 className="font-bold text-lg text-[#172B3A]">{item.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Created on {formatDate(item.createdAt, locale)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyText(item)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-medium text-gray-700 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy Text
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-medium text-gray-700 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    {t("generatedContent")}
                  </h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
                    {item.content}
                  </p>
                </div>

                {item.questions && item.questions.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-[#087F72]" />
                      {t("doctorQuestions")}
                    </h4>
                    <ul className="space-y-1.5 pl-2">
                      {item.questions.map((q, qIdx) => (
                        <li key={qIdx} className="text-xs text-gray-800 flex items-start gap-2">
                          <span className="text-[#087F72] font-bold">•</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal: New Visit Summary */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <h3 className="text-lg font-bold text-[#172B3A]">{t("createNew")}</h3>
              <p className="text-xs text-gray-500">
                Organize your symptoms, {confirmed.observations.length} confirmed lab observations, {confirmed.medications.length} active medications, and list of questions for your clinician.
              </p>

              <form onSubmit={handleCreateSummary} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t("summaryTitle")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Annual Health Checkup or Cardiologist Follow-up"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t("generatedContent")} (Symptoms, history, notes)
                  </label>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter any recent changes in symptoms, how you feel on current medications, or notes for the doctor..."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t("doctorQuestions")} (one per line)
                  </label>
                  <textarea
                    rows={4}
                    value={questions}
                    onChange={(e) => setQuestions(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden resize-none font-sans"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    {common("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-[#087F72] hover:bg-[#06665B] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {saving ? common("loading") : common("save")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
