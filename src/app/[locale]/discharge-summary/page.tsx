"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  Building2,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Info,
  Download,
  Eye,
  X,
  Stethoscope,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type { ExtractionPayload } from "@/lib/ai/schemas";

interface DocumentItem {
  id: string;
  category: string;
  displayName: string;
  mimeType: string;
  fileSize: number;
  processingStatus: string;
  processingNote?: string;
  sourceDate?: string;
  createdAt: string;
}

type DischargeExtraction = Partial<ExtractionPayload>;

interface ObservationItem {
  id: string;
  name: string;
  value: string;
  unit: string;
  referenceRange?: string;
  uncertain: boolean;
  verificationStatus: "unconfirmed" | "confirmed" | "rejected";
}

export default function DischargeSummaryPage() {
  const common = useTranslations("common");
  const t = useTranslations("dischargeSummaryPage");
  const locale = useLocale();
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dedicated Discharge Summary Modal View
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [viewModalLoading, setViewModalLoading] = useState(false);
  const [docObservations, setDocObservations] = useState<ObservationItem[]>([]);
  const [docExtraction, setDocExtraction] = useState<DischargeExtraction | null>(null);

  const fetchDischargeSummaries = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.status === 401) {
        router.push("/auth/sign-in");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        const dischargeDocs = (json.documents || []).filter(
          (d: DocumentItem) => d.category === "discharge_summary"
        );
        setDocuments(dischargeDocs);
      }
    } catch {
      toast.error("Failed to load discharge summaries");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDischargeSummaries();
  }, [fetchDischargeSummaries]);

  const openSummaryModal = async (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setViewModalLoading(true);
    setDocObservations([]);
    setDocExtraction(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}`);
      if (res.ok) {
        const json = await res.json();
        setDocObservations(json.observations || []);
        const latestExtraction = (json.extractions || []).sort(
          (left: { createdAt: string }, right: { createdAt: string }) =>
            right.createdAt.localeCompare(left.createdAt),
        )[0];
        setDocExtraction(
          latestExtraction?.structured as DischargeExtraction | undefined ?? null,
        );
      } else {
        toast.error("Could not fetch document details");
      }
    } catch {
      toast.error("Could not fetch document details");
    } finally {
      setViewModalLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10MB limit.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "discharge_summary");

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
        toast.success("Hospital discharge summary uploaded successfully!");
        fetchDischargeSummaries();
        if (data.document) {
          openSummaryModal(data.document);
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
    if (!confirm("Are you sure you want to delete this discharge summary?")) return;

    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Discharge summary deleted");
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        if (selectedDoc?.id === id) {
          setSelectedDoc(null);
        }
      } else {
        toast.error("Failed to delete discharge summary");
      }
    } catch {
      toast.error("Network error");
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#DDF5F0] text-[#087F8C]">
                <Building2 className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#17344F] tracking-tight">
                Hospital Discharge Summaries
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#61768A]">
              Dedicated inpatient hospital stay summaries, admission & discharge records, treatment courses, and follow-up clinical orders.
            </p>
          </div>
        </div>

        {/* Upload Drop Zone for Discharge Summaries */}
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
                {uploading ? common("loading") : "Upload Hospital Discharge Summary"}
              </p>
              <p className="text-xs text-[#61768A] mt-0.5">
                Drop your discharge card, hospital summary PDF, or scan (up to 10MB)
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF9F5] text-[#087F8C] text-[11px] font-semibold border border-teal-100">
              <Info className="w-3.5 h-3.5" />
              Categorized specifically under Inpatient Discharge Summaries
            </div>
          </div>
        </div>

        {/* Discharge Summaries Table */}
        <div className="bg-white rounded-xl border border-[#E1EBF0] shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E9F0F3] flex items-center justify-between">
            <h3 className="font-bold text-sm sm:text-base text-[#17344F]">
              Hospital Discharge Records
            </h3>
            <span className="text-xs text-[#61768A] font-medium">
              {documents.length} recorded
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">{common("loading")}</div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500 space-y-3">
              <Building2 className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="font-medium text-[#17344F]">No discharge summaries uploaded yet.</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Upload your discharge notes or post-op hospitalization papers above to keep track of treatment courses and doctor instructions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F7FAFC] border-b border-[#E1EBF0] text-xs font-semibold text-[#61768A] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Hospital / Summary Name</th>
                    <th className="px-5 py-3.5">Classification</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Discharge / Record Date</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9F0F3]">
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => openSummaryModal(doc)}
                      className="hover:bg-[#F7FAFC] cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4 font-semibold text-[#17344F] flex items-center gap-2.5">
                        <Building2 className="w-4 h-4 text-[#087F8C] shrink-0" />
                        <span className="truncate max-w-[280px]">{doc.displayName}</span>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-teal-800">
                        Discharge Summary
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
                      <td className="px-5 py-4 text-xs text-[#61768A]">
                        {formatDate(doc.sourceDate || doc.createdAt, locale)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSummaryModal(doc);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#DDF5F0] hover:bg-teal-100 text-[#087F8C] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Summary
                          </button>
                          <a
                            href={`/api/documents/${doc.id}/file`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg text-[#61768A] hover:text-[#087F8C] hover:bg-gray-100 transition-colors"
                            title="Download original file"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(doc.id, e)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete discharge summary"
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

        {/* Dedicated Hospital Discharge Summary View Modal */}
        {selectedDoc && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-[#E1EBF0] shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-[#E9F0F3] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#DDF5F0] text-[#087F8C] border border-teal-200 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#17344F]">
                      {selectedDoc.displayName}
                    </h3>
                    <p className="text-xs text-[#61768A]">
                      Discharge Summary · Uploaded on {formatDate(selectedDoc.createdAt, locale)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status and Metadata Card */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#F7FAFC] border border-[#E1EBF0] rounded-xl p-3.5 text-xs">
                <div>
                  <span className="text-[#8294A4] block text-[10px] uppercase font-bold">Category</span>
                  <span className="font-semibold text-[#17344F] flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3.5 h-3.5 text-[#087F8C]" /> Inpatient Discharge
                  </span>
                </div>
                <div>
                  <span className="text-[#8294A4] block text-[10px] uppercase font-bold">Processing Status</span>
                  <span className="font-semibold text-emerald-700 capitalize mt-0.5 block">
                    {selectedDoc.processingStatus.replace("_", " ")}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[#8294A4] block text-[10px] uppercase font-bold">File Size</span>
                  <span className="font-semibold text-[#17344F] mt-0.5 block">
                    {(selectedDoc.fileSize / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>

              {/* Clinical Sections & Verified Details */}
              <div className="space-y-4">
                <div className="p-4 bg-[#EFF9F5] border border-teal-100 rounded-xl text-xs text-teal-900 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-[#087F8C]">
                    <Stethoscope className="w-4 h-4" />
                    Hospital Stay & Post-Discharge Clinical Care
                  </div>
                  <p className="text-[#17344F] leading-relaxed">{t("sourceBasedOnly")}</p>
                </div>

                <section className="border border-[#E1EBF0] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-[#F7FAFC] border-b border-[#E1EBF0]">
                    <h4 className="text-xs font-bold text-[#17344F]">{t("aiSummary")}</h4>
                  </div>
                  {viewModalLoading ? (
                    <p className="p-5 text-xs text-gray-500 animate-pulse">{common("loading")}</p>
                  ) : docExtraction?.dischargeSummary ? (
                    <div className="p-4 space-y-4">
                      <p className="text-sm text-[#17344F] leading-relaxed whitespace-pre-wrap">
                        {docExtraction.dischargeSummary}
                      </p>
                      {docExtraction.translatedSummary &&
                        docExtraction.translatedSummary !== docExtraction.dischargeSummary && (
                          <div className="border-t border-[#E9F0F3] pt-3">
                            <h5 className="text-[11px] font-bold text-[#61768A] mb-1">
                              {t("translatedSummary")}
                            </h5>
                            <p className="text-sm text-[#17344F] leading-relaxed whitespace-pre-wrap">
                              {docExtraction.translatedSummary}
                            </p>
                          </div>
                        )}
                      {(docExtraction.notes?.length || docExtraction.unreadableRegions?.length) ? (
                        <div className="border-t border-amber-100 pt-3 text-xs text-amber-800 space-y-1">
                          {docExtraction.notes?.map((note, index) => <p key={`note-${index}`}>{note}</p>)}
                          {docExtraction.unreadableRegions?.map((region, index) => (
                            <p key={`unreadable-${index}`}>{region}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="p-4 text-xs text-[#61768A] leading-relaxed">
                      {selectedDoc.processingNote || t("summaryUnavailable")}
                    </p>
                  )}
                </section>

                {/* Extracted Clinical Observations or Labs inside this summary */}
                <div className="border border-[#E1EBF0] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-[#F7FAFC] border-b border-[#E1EBF0] flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#17344F] flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-[#087F8C]" />
                      Extracted Discharge Vitals & Findings
                    </h4>
                    <span className="text-[10px] text-[#8294A4] font-medium">
                      {docObservations.length} entries
                    </span>
                  </div>

                  {viewModalLoading ? (
                    <div className="p-6 text-center text-xs text-gray-500 animate-pulse">
                      Loading clinical details...
                    </div>
                  ) : docObservations.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-500 space-y-1">
                      <p className="font-semibold text-[#17344F]">Document stored securely in your health companion.</p>
                      <p className="text-[11px] text-[#8294A4]">
                        You can view the original hospital paperwork or download the scanned document below.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E9F0F3] max-h-48 overflow-y-auto">
                      {docObservations.map((obs) => (
                        <div key={obs.id} className="p-3 text-xs flex items-center justify-between hover:bg-gray-50">
                          <div>
                            <span className="font-bold text-[#17344F]">{obs.name}</span>
                            <span className="text-[#8294A4] ml-2 text-[11px]">{obs.unit || ""}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#087F8C]">{obs.value}</span>
                            {obs.verificationStatus === "confirmed" && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E9F0F3]">
                <a
                  href={`/api/documents/${selectedDoc.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl border border-[#E1EBF0] hover:bg-[#F7FAFC] text-[#17344F] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#087F8C]" />
                  Download Original File
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="px-4 py-2 rounded-xl bg-[#087F8C] hover:bg-[#07545B] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}