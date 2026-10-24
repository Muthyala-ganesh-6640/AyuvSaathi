"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Info,
  Sparkles,
  Activity,
  MessageSquare,
  Download,
  ExternalLink,
  Check,
  Copy,
  Calendar,
  X,
  Stethoscope,
  ChevronRight,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { compareToSourceRange } from "@/lib/medical/ranges";
import type { ReportAnalysisResult } from "@/lib/medical/report-summary";

interface DocumentItem {
  id: string;
  category: string;
  displayName: string;
  mimeType: string;
  fileSize: number;
  processingStatus: string;
  sourceDate?: string;
  createdAt: string;
}

interface ObservationItem {
  id: string;
  name: string;
  value: string;
  unit: string;
  referenceRange?: string;
  uncertain?: boolean;
  verificationStatus: "unconfirmed" | "confirmed" | "rejected";
  provenance: string;
}

interface ActiveReportDetail {
  document: DocumentItem;
  observations: ObservationItem[];
  analysis: ReportAnalysisResult;
}

export default function ReportsPage() {
  const t = useTranslations("reports");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressStep, setUploadProgressStep] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<
    "lab_report" | "diagnostic_report" | "discharge_summary" | "doctor_visit" | "imaging" | "other"
  >("lab_report");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [activeReport, setActiveReport] = useState<ActiveReportDetail | null>(null);
  const [loadingReportDetail, setLoadingReportDetail] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [copiedQuestions, setCopiedQuestions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const fetchDocumentDetail = useCallback(
    async (id: string, autoScroll = false) => {
      setLoadingReportDetail(true);
      try {
        const res = await fetch(`/api/documents/${id}`);
        if (res.ok) {
          const json = await res.json();
          setActiveReport({
            document: json.document,
            observations: json.observations || [],
            analysis: json.analysis,
          });
          if (autoScroll) {
            setTimeout(() => {
              summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
          }
        } else {
          toast.error("Failed to load report analysis");
        }
      } catch {
        toast.error("Network error loading report analysis");
      } finally {
        setLoadingReportDetail(false);
      }
    },
    []
  );

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.status === 401) {
        router.push("/auth/sign-in");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        const docs = json.documents || [];
        setDocuments(docs);
        // If no active report currently selected and documents exist, load the latest one
        if (docs.length > 0 && !activeReport) {
          fetchDocumentDetail(docs[0].id, false);
        }
      }
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [router, activeReport, fetchDocumentDetail]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10MB limit.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", uploadCategory);
    formData.append("language", locale);

    setUploading(true);
    setUploadProgressStep("Uploading file to secure clinical storage...");

    try {
      const stepTimer = setTimeout(() => {
        setUploadProgressStep("Running OCR & extracting biomarker observations...");
      }, 1200);

      const stepTimer2 = setTimeout(() => {
        setUploadProgressStep("Synthesizing comprehensive clinical summary & evaluating reference ranges...");
      }, 2800);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Upload failed");
      } else {
        toast.success("Report uploaded and analyzed successfully!");
        fetchDocuments();
        if (data.document?.id) {
          // Immediately set the active report detail and scroll down to the summary
          if (data.analysis && data.observations) {
            setActiveReport({
              document: data.document,
              observations: data.observations,
              analysis: data.analysis,
            });
            setTimeout(() => {
              summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
          } else {
            fetchDocumentDetail(data.document.id, true);
          }
        }
      }
    } catch {
      toast.error("Network error during file upload.");
    } finally {
      setUploading(false);
      setUploadProgressStep("");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this medical report?")) return;

    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Report deleted");
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        if (activeReport?.document.id === id) {
          setActiveReport(null);
        }
      } else {
        toast.error("Failed to delete report");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleConfirmObservation = async (obsId: string) => {
    try {
      const res = await fetch(`/api/observations/${obsId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ verificationStatus: "confirmed" }),
      });
      if (res.ok) {
        toast.success("Observation confirmed into your verified records!");
        setActiveReport((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            observations: prev.observations.map((o) =>
              o.id === obsId ? { ...o, verificationStatus: "confirmed" } : o
            ),
          };
        });
      } else {
        toast.error("Failed to confirm observation");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleConfirmAll = async () => {
    if (!activeReport) return;
    const unconfirmed = activeReport.observations.filter((o) => o.verificationStatus !== "confirmed");
    if (unconfirmed.length === 0) {
      toast.info("All observations are already confirmed.");
      return;
    }

    setConfirmingAll(true);
    try {
      await Promise.all(
        unconfirmed.map((obs) =>
          fetch(`/api/observations/${obs.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ verificationStatus: "confirmed" }),
          })
        )
      );
      toast.success(`Successfully confirmed ${unconfirmed.length} values!`);
      setActiveReport((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          observations: prev.observations.map((o) => ({ ...o, verificationStatus: "confirmed" })),
        };
      });
    } catch {
      toast.error("Error confirming observations");
    } finally {
      setConfirmingAll(false);
    }
  };

  const handleCopyQuestions = () => {
    if (!activeReport?.analysis.suggestedQuestions.length) return;
    const questionsText = activeReport.analysis.suggestedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n");
    navigator.clipboard.writeText(questionsText);
    setCopiedQuestions(true);
    toast.success("Doctor questions copied to clipboard!");
    setTimeout(() => setCopiedQuestions(false), 2000);
  };

  const filteredDocuments = documents.filter((doc) => {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "labs") {
      return doc.category === "lab_report" || doc.category === "diagnostic_report";
    }
    if (categoryFilter === "discharge") {
      return doc.category === "discharge_summary";
    }
    if (categoryFilter === "visit") {
      return doc.category === "doctor_visit";
    }
    if (categoryFilter === "imaging") {
      return doc.category === "imaging";
    }
    return doc.category === categoryFilter;
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#DDF5F0] text-[#087F8C]">
                <FileText className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#17344F] tracking-tight">
                {t("title")}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#61768A]">
              {t("subtitle")}
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-[#E1EBF0] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                categoryFilter === "all" ? "bg-[#087F8C] text-white" : "text-[#61768A] hover:text-[#17344F]"
              }`}
            >
              All Records
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("labs")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                categoryFilter === "labs" ? "bg-[#087F8C] text-white" : "text-[#61768A] hover:text-[#17344F]"
              }`}
            >
              Lab & Diagnostics
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("discharge")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                categoryFilter === "discharge" ? "bg-[#087F8C] text-white" : "text-[#61768A] hover:text-[#17344F]"
              }`}
            >
              Discharge Summaries
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("visit")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                categoryFilter === "visit" ? "bg-[#087F8C] text-white" : "text-[#61768A] hover:text-[#17344F]"
              }`}
            >
              Doctor Visits
            </button>
          </div>
        </div>

        {/* Upload Drop Zone with explicit Category Selection */}
        <div className="bg-white rounded-xl border border-[#E1EBF0] p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E9F0F3]">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#087F8C]" />
              <span className="text-xs font-bold text-[#17344F]">Document Classification before Upload:</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as typeof uploadCategory)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E1EBF0] bg-[#F7FAFC] text-[#17344F] focus:outline-hidden focus:border-[#087F8C]"
              >
                <option value="lab_report">Lab Report (Blood, Urine, Biochemistry, CBC)</option>
                <option value="diagnostic_report">Diagnostic Report (Pathology, ECG, Echo)</option>
                <option value="discharge_summary">Hospital Discharge Summary</option>
                <option value="doctor_visit">Doctor Visit / Consultation Summary</option>
                <option value="imaging">Imaging (X-Ray, MRI, CT Scan)</option>
                <option value="other">Other Medical Record</option>
              </select>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files?.[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => {
              if (!uploading) fileInputRef.current?.click();
            }}
            className={`p-7 rounded-xl border-2 border-dashed text-center cursor-pointer transition-all ${
              uploading
                ? "border-[#087F8C] bg-[#F0FBF9] cursor-wait"
                : dragActive
                ? "border-[#087F8C] bg-[#EFF9F5]"
                : "border-[#E1EBF0] bg-white hover:border-[#087F8C] hover:bg-[#F7FAFC]"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg"
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
              }}
            />
            <div className="max-w-md mx-auto space-y-2.5">
              <div className="w-12 h-12 rounded-xl bg-[#DDF5F0] text-[#087F8C] border border-teal-200 mx-auto flex items-center justify-center">
                {uploading ? (
                  <Activity className="w-6 h-6 animate-spin text-[#087F8C]" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="font-bold text-sm sm:text-base text-[#17344F]">
                  {uploading ? "Analyzing Report..." : t("uploadBoxTitle")}
                </p>
                <p className="text-xs text-[#61768A] mt-0.5">
                  {uploading
                    ? uploadProgressStep || "Processing report and extracting biomarkers..."
                    : t("uploadBoxSubtitle")}
                </p>
              </div>

              {uploading && (
                <div className="w-full bg-teal-100 rounded-full h-1.5 overflow-hidden mt-3">
                  <div className="bg-[#087F8C] h-1.5 rounded-full animate-pulse w-3/4"></div>
                </div>
              )}

              {!uploading && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF9F5] text-[#087F8C] text-[11px] font-semibold border border-teal-100">
                  <Info className="w-3.5 h-3.5" />
                  {t("aiNotice")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COMPLETE REPORT ANALYSIS & SUMMARY DASHBOARD (BELOW UPLOADED REPORT) */}
        {loadingReportDetail && !activeReport && (
          <div className="bg-white rounded-xl border border-[#E1EBF0] p-8 text-center text-sm text-[#61768A] flex items-center justify-center gap-2">
            <Activity className="w-5 h-5 animate-spin text-[#087F8C]" />
            Loading complete report analysis & clinical summary...
          </div>
        )}

        {activeReport && (
          <div
            ref={summaryRef}
            className="bg-white rounded-2xl border-2 border-[#087F8C]/30 shadow-md overflow-hidden space-y-0 transition-all animate-in fade-in slide-in-from-top-4 duration-300"
          >
            {/* Top Ribbon Header */}
            <div className="bg-gradient-to-r from-[#17344F] via-[#1E4264] to-[#087F8C] text-white p-5 sm:p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white uppercase tracking-wider backdrop-blur-xs">
                      {activeReport.document.category.replace("_", " ")}
                    </span>
                    {activeReport.analysis.overallStatus === "normal" && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-white flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> All Values Within Normal Range
                      </span>
                    )}
                    {activeReport.analysis.overallStatus === "abnormal_findings" && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {activeReport.analysis.abnormalCount} Out-of-Range Parameter(s)
                      </span>
                    )}
                    <span className="text-xs text-white/70 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Uploaded {formatDate(activeReport.document.createdAt, locale)}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-teal-300" />
                    {activeReport.document.displayName}
                  </h2>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/assistant?q=${encodeURIComponent(
                      `Explain my latest ${activeReport.document.displayName} report findings and what the results mean.`
                    )}`}
                    className="px-3.5 py-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-[#17344F] font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Ask Health Assistant
                  </Link>

                  <a
                    href={`/api/documents/${activeReport.document.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors border border-white/10"
                    title="Download original file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Original File
                  </a>

                  <Link
                    href={`/reports/${activeReport.document.id}`}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors border border-white/10"
                    title="Open dedicated editor"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Full Details
                  </Link>

                  <button
                    type="button"
                    onClick={() => setActiveReport(null)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                    title="Close analysis view"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content Sections Container */}
            <div className="p-5 sm:p-7 space-y-6">
              {/* 1. Complete Clinical Report Summary Box */}
              <div className="bg-gradient-to-br from-[#F4FBF9] to-[#E9F8F5] border border-teal-200/80 rounded-2xl p-5 sm:p-6 space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-teal-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-[#087F8C] text-white">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <h3 className="font-black text-sm sm:text-base text-[#17344F]">
                      Complete Clinical Summary & Key Findings
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-teal-800 bg-teal-100/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#087F8C]" />
                    AI Grounded in Uploaded Record
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[#172B3A] leading-relaxed whitespace-pre-line font-medium">
                  {activeReport.analysis.summary}
                </p>

                {activeReport.analysis.translatedSummary && (
                  <div className="mt-3 pt-3 border-t border-teal-200/60 bg-white/60 p-3 rounded-xl">
                    <span className="text-[11px] font-bold text-[#087F8C] uppercase tracking-wider block mb-1">
                      Native Language Overview ({locale === "te" ? "తెలుగు" : locale === "hi" ? "हिन्दी" : "Translation"}):
                    </span>
                    <p className="text-xs sm:text-sm text-gray-800 leading-relaxed font-medium">
                      {activeReport.analysis.translatedSummary}
                    </p>
                  </div>
                )}
              </div>

              {/* 2. Key Metrics Bar (Quick Glance) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#F8FAFC] border border-[#E1EBF0] p-3.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-[#61768A] uppercase tracking-wider block">
                    Total Tests Tested
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-[#17344F]">
                    {activeReport.analysis.totalTests}
                  </span>
                </div>

                <div className="bg-[#F0FDF4] border border-emerald-200 p-3.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                    Normal (In-Range)
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-800">
                    {activeReport.analysis.normalCount}
                  </span>
                </div>

                <div className={`p-3.5 rounded-xl border ${
                  activeReport.analysis.abnormalCount > 0
                    ? "bg-[#FFFBEB] border-amber-300"
                    : "bg-[#F8FAFC] border-[#E1EBF0]"
                }`}>
                  <span className={`text-[11px] font-semibold uppercase tracking-wider block ${
                    activeReport.analysis.abnormalCount > 0 ? "text-amber-800" : "text-[#61768A]"
                  }`}>
                    Attention / Out-of-Range
                  </span>
                  <span className={`text-xl sm:text-2xl font-black ${
                    activeReport.analysis.abnormalCount > 0 ? "text-amber-900" : "text-[#17344F]"
                  }`}>
                    {activeReport.analysis.abnormalCount}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E1EBF0] p-3.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-[#61768A] uppercase tracking-wider block">
                    Report Collection Date
                  </span>
                  <span className="text-sm sm:text-base font-bold text-[#17344F] flex items-center gap-1 mt-1">
                    <Calendar className="w-4 h-4 text-[#087F8C]" />
                    {activeReport.analysis.reportDate || "Not Stated"}
                  </span>
                </div>
              </div>

              {/* 3. Attention Areas / Out-of-Range Findings Warning Box (If any) */}
              {activeReport.analysis.abnormalItems.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-300/80 rounded-xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Out-of-Range Biomarkers Requiring Clinical Attention ({activeReport.analysis.abnormalItems.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {activeReport.analysis.abnormalItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-amber-200 rounded-lg p-3 shadow-xs flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-xs text-[#17344F]">{item.name}</p>
                          <p className="text-xs text-gray-600">
                            Measured: <span className="font-black text-amber-900">{item.value} {item.unit}</span>
                          </p>
                          {item.referenceRange && (
                            <p className="text-[10px] text-gray-500">Ref Range: {item.referenceRange}</p>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Complete Extracted Biomarkers Table (Interactive Verification) */}
              <div className="border border-[#E1EBF0] rounded-xl overflow-hidden shadow-xs">
                <div className="p-4 bg-gray-50 border-b border-[#E1EBF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#087F8C]" />
                    <h4 className="font-bold text-sm text-[#17344F]">
                      Extracted Biomarkers & Test Observations ({activeReport.observations.length})
                    </h4>
                  </div>
                  {activeReport.observations.length > 0 && (
                    <button
                      type="button"
                      disabled={confirmingAll}
                      onClick={handleConfirmAll}
                      className="px-3 py-1.5 rounded-lg bg-[#087F8C] hover:bg-[#076b77] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer self-start sm:self-auto"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {confirmingAll ? "Confirming..." : "Confirm All Values"}
                    </button>
                  )}
                </div>

                {activeReport.observations.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-500">
                    No specific biomarkers extracted. You can open Full Details to manually add test values.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F7FAFC] border-b border-gray-200 sticky top-0 z-10 font-bold text-gray-600 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Biomarker / Test</th>
                          <th className="px-4 py-3">Result Value</th>
                          <th className="px-4 py-3">Standard Reference Range</th>
                          <th className="px-4 py-3">Clinical Evaluation</th>
                          <th className="px-4 py-3 text-right">Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium">
                        {activeReport.observations.map((obs) => {
                          const status = compareToSourceRange(obs.value, obs.referenceRange);
                          return (
                            <tr key={obs.id} className="hover:bg-gray-50/80 transition-colors">
                              <td className="px-4 py-3 font-semibold text-[#172B3A]">
                                {obs.name}
                              </td>
                              <td className="px-4 py-3 font-bold text-gray-900">
                                {obs.value} <span className="text-gray-500 font-normal">{obs.unit}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {obs.referenceRange || "Not specified in report"}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                    status === "in_range"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : status === "out_of_range"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  {status === "in_range" ? "NORMAL" : status === "out_of_range" ? "OUT OF RANGE" : "UNSPECIFIED"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {obs.verificationStatus === "confirmed" ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmObservation(obs.id)}
                                    className="px-2.5 py-1 rounded-md bg-teal-50 hover:bg-teal-100 text-[#087F8C] text-[11px] font-bold transition-colors cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 5. Recommended Questions to Ask Your Doctor */}
              {activeReport.analysis.suggestedQuestions.length > 0 && (
                <div className="bg-[#F8FAFC] border border-[#E1EBF0] rounded-xl p-4 sm:p-5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 border-b border-[#E1EBF0] pb-2">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-[#087F8C]" />
                      <h4 className="font-bold text-xs sm:text-sm text-[#17344F]">
                        Suggested Questions for Your Next Doctor Consultation
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyQuestions}
                      className="text-xs text-[#087F8C] hover:text-[#076b77] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedQuestions ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Questions
                        </>
                      )}
                    </button>
                  </div>
                  <ul className="space-y-1.5 text-xs text-gray-700 font-medium">
                    {activeReport.analysis.suggestedQuestions.map((q, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-teal-100 text-[#087F8C] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documents History Table */}
        <div className="bg-white rounded-xl border border-[#E1EBF0] shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E9F0F3] flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#17344F]">Uploaded Medical Documents History</h3>
              <p className="text-xs text-[#61768A]">Click &quot;View Summary&quot; on any report to review its complete analysis above.</p>
            </div>
            <span className="text-xs text-[#61768A] font-semibold bg-[#F7FAFC] px-3 py-1 rounded-full border border-[#E1EBF0]">
              {filteredDocuments.length} files recorded
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">{common("loading")}</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500 space-y-2">
              <FileText className="w-8 h-8 text-gray-300 mx-auto" />
              <p>{t("noObservations")}</p>
              <p className="text-xs text-gray-400">Upload a lab report or consultation note to view its instant clinical analysis.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">{t("testName")}</th>
                    <th className="px-5 py-3.5">{t("category")}</th>
                    <th className="px-5 py-3.5">{t("processingStatus")}</th>
                    <th className="px-5 py-3.5">{t("date")}</th>
                    <th className="px-5 py-3.5 text-right">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDocuments.map((doc) => {
                    const isSelected = activeReport?.document.id === doc.id;
                    return (
                      <tr
                        key={doc.id}
                        onClick={() => fetchDocumentDetail(doc.id, true)}
                        className={`hover:bg-teal-50/40 cursor-pointer transition-colors ${
                          isSelected ? "bg-teal-50/70 border-l-4 border-l-[#087F8C]" : ""
                        }`}
                      >
                        <td className="px-5 py-4 font-semibold text-[#172B3A] flex items-center gap-2.5">
                          <FileText className={`w-4 h-4 shrink-0 ${isSelected ? "text-[#087F8C]" : "text-gray-400"}`} />
                          <span className="truncate max-w-[280px]">{doc.displayName}</span>
                        </td>
                        <td className="px-5 py-4 text-xs capitalize text-gray-600">
                          {doc.category.replace("_", " ")}
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <span
                            className={`px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 ${
                              doc.processingStatus === "extracted"
                                ? "bg-emerald-100 text-emerald-800"
                                : doc.processingStatus === "needs_review"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {doc.processingStatus === "extracted" && <CheckCircle2 className="w-3 h-3" />}
                            {doc.processingStatus === "needs_review" && <AlertTriangle className="w-3 h-3" />}
                            {doc.processingStatus}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500">
                          {formatDate(doc.sourceDate || doc.createdAt, locale)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => fetchDocumentDetail(doc.id, true)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-[#087F8C] text-white"
                                  : "bg-teal-50 hover:bg-teal-100 text-[#087F8C]"
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              View Summary
                            </button>
                            <Link
                              href={`/reports/${doc.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold inline-flex items-center gap-1"
                              title="Full detail page"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(doc.id, e)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title={t("deleteDocument")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
