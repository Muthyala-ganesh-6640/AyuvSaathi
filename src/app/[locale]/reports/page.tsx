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
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

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

export default function ReportsPage() {
  const t = useTranslations("reports");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<
    "lab_report" | "diagnostic_report" | "discharge_summary" | "doctor_visit" | "imaging" | "other"
  >("lab_report");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.status === 401) {
        router.push("/auth/sign-in");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setDocuments(json.documents);
      }
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [router]);

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

    setUploading(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Upload failed");
      } else {
        toast.success("Document uploaded successfully!");
        fetchDocuments();
        if (data.document?.id) {
          router.push(`/reports/${data.document.id}`);
        }
      }
    } catch {
      toast.error("Network error during file upload.");
    } finally {
      setUploading(false);
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
      } else {
        toast.error("Failed to delete report");
      }
    } catch {
      toast.error("Network error");
    }
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
      <div className="space-y-6">
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
                <option value="lab_report">Lab Report (Blood, Urine, Biochemistry)</option>
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
            onClick={() => fileInputRef.current?.click()}
            className={`p-7 rounded-xl border-2 border-dashed text-center cursor-pointer transition-all ${
              dragActive
                ? "border-[#087F8C] bg-[#EFF9F5]"
                : "border-[#E1EBF0] bg-white hover:border-[#087F8C] hover:bg-[#F7FAFC]"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
              }}
            />
            <div className="max-w-md mx-auto space-y-2.5">
              <div className="w-12 h-12 rounded-xl bg-[#DDF5F0] text-[#087F8C] border border-teal-200 mx-auto flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-sm sm:text-base text-[#17344F]">
                  {uploading ? common("loading") : t("uploadBoxTitle")}
                </p>
                <p className="text-xs text-[#61768A] mt-0.5">{t("uploadBoxSubtitle")}</p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF9F5] text-[#087F8C] text-[11px] font-semibold border border-teal-100">
                <Info className="w-3.5 h-3.5" />
                {t("aiNotice")}
              </div>
            </div>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white rounded-xl border border-[#E1EBF0] shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E9F0F3] flex items-center justify-between">
            <h3 className="font-bold text-sm sm:text-base text-[#17344F]">{t("title")}</h3>
            <span className="text-xs text-[#61768A] font-medium">
              {filteredDocuments.length} files
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">{common("loading")}</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500 space-y-2">
              <p>{t("noObservations")}</p>
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
                  {filteredDocuments.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => router.push(`/reports/${doc.id}`)}
                      className="hover:bg-gray-50/80 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4 font-semibold text-[#172B3A] flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-[#087F72] shrink-0" />
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
                          {doc.processingStatus === "extracted" && (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          {doc.processingStatus === "needs_review" && (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {doc.processingStatus}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {formatDate(doc.sourceDate || doc.createdAt, locale)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/reports/${doc.id}`}
                            className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#087F72] text-xs font-semibold inline-flex items-center gap-1"
                          >
                            {t("viewDocument")}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}