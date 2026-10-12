"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useCallback, useEffect, useState, use } from "react";
import {
  FileText,
  Download,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
  Info,
  Check,
  HelpCircle,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { compareToSourceRange, rangeLabel } from "@/lib/medical/ranges";
import { formatDate } from "@/lib/utils";

interface ObservationItem {
  id: string;
  name: string;
  value: string;
  unit: string;
  referenceRange?: string;
  uncertain: boolean;
  verificationStatus: "unconfirmed" | "confirmed" | "rejected";
  provenance: string;
}

interface DocumentDetail {
  id: string;
  displayName: string;
  category: string;
  mimeType: string;
  fileSize: number;
  processingStatus: string;
  createdAt: string;
}

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("reports");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [observations, setObservations] = useState<ObservationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual observation entry modal/state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newRange, setNewRange] = useState("");
  const [savingObs, setSavingObs] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (res.status === 401) {
        router.push("/auth/sign-in");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setDocument(json.document);
        setObservations(json.observations);
      } else {
        toast.error("Document not found");
      }
    } catch {
      toast.error("Failed to load document");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleConfirmObservation = async (obsId: string) => {
    try {
      const res = await fetch(`/api/observations/${obsId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ verificationStatus: "confirmed" }),
      });
      if (res.ok) {
        toast.success("Value confirmed! It is now saved as a verified record.");
        setObservations((prev) =>
          prev.map((o) => (o.id === obsId ? { ...o, verificationStatus: "confirmed" } : o))
        );
      } else {
        toast.error("Failed to confirm observation");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleAddManualObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newValue) {
      toast.error("Test name and value are required.");
      return;
    }

    setSavingObs(true);
    try {
      const res = await fetch("/api/observations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentId: id,
          name: newName,
          value: newValue,
          unit: newUnit,
          referenceRange: newRange,
        }),
      });
      const data = await res.json();
      if (res.ok && data.observation) {
        toast.success("Observation added from document!");
        setObservations((prev) => [data.observation, ...prev]);
        setShowAddModal(false);
        setNewName("");
        setNewValue("");
        setNewUnit("");
        setNewRange("");
      } else {
        toast.error(data.error || "Could not add observation");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSavingObs(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-gray-500 animate-pulse">
          {common("loading")}
        </div>
      </AppShell>
    );
  }

  if (!document) {
    return (
      <AppShell>
        <div className="p-12 text-center text-gray-500">
          <p>Document not found.</p>
          <Link href="/reports" className="text-[#087F72] font-semibold underline mt-2 block">
            Return to Reports
          </Link>
        </div>
      </AppShell>
    );
  }

  const isDischarge = document.category === "discharge_summary";
  const backHref = isDischarge ? "/discharge-summary" : "/reports";
  const backLabel = isDischarge ? "Back to Discharge Summaries" : "Back to Reports";

  return (
    <AppShell>
      <div className="space-y-8 py-2">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
          </Link>
        </div>

        {/* Document Header Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 text-[#087F72] flex items-center justify-center shrink-0">
              {isDischarge ? <Building2 className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#172B3A]">{document.displayName}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
                <span className="capitalize font-semibold text-teal-800">
                  {isDischarge ? "Hospital Discharge Summary" : document.category.replace("_", " ")}
                </span>
                <span>•</span>
                <span>{(document.fileSize / 1024).toFixed(1)} KB</span>
                <span>•</span>
                <span>Uploaded: {formatDate(document.createdAt, locale)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <a
              href={`/api/documents/${document.id}/file`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#E1EBF0] hover:bg-[#F7FAFC] text-[#17344F] text-xs font-semibold transition-colors"
            >
              <Download className="w-4 h-4 text-[#087F8C]" />
              View Original File
            </a>
            {!isDischarge && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#087F8C] hover:bg-[#07545B] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Test Value
              </button>
            )}
          </div>
        </div>

        {/* Notice on Verification */}
        <div className="p-4 bg-[#EFF9F5] border border-teal-100 rounded-xl text-xs text-teal-900 flex items-start gap-3">
          <Info className="w-4 h-4 text-[#087F8C] shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[#17344F]">
            {isDischarge ? (
              <>
                Official <strong>Hospital Discharge Summary</strong>. Review any extracted vitals, medications, or lab notes below. Confirmed results are stored directly in your permanent health profile.
              </>
            ) : (
              <>
                {t("aiNotice")} Review each test below and click <strong>Confirm Value</strong>. Confirmed results are safely stored in your health profile for grounded summaries and doctor consult checklists.
              </>
            )}
          </p>
        </div>

        {/* Extracted Observations Table */}
        <div className="bg-white rounded-xl border border-[#E1EBF0] shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E9F0F3] flex items-center justify-between">
            <h3 className="font-bold text-base text-[#172B3A]">
              {isDischarge ? "Extracted Clinical Findings & Discharge Vitals" : t("observationsTitle")}
            </h3>
            <span className="text-xs text-gray-500 font-medium">
              {observations.length} observation{observations.length === 1 ? "" : "s"}
            </span>
          </div>

          {observations.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500 space-y-3">
              <p>
                {isDischarge
                  ? "No individual laboratory metrics found in this summary. The discharge document is safely preserved."
                  : t("noObservations")}
              </p>
              {!isDischarge && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-50 text-[#087F72] border border-teal-200 font-semibold text-xs hover:bg-teal-100 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Test Result Manually
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">{t("testName")}</th>
                    <th className="px-5 py-3.5">{t("result")}</th>
                    <th className="px-5 py-3.5">{t("unit")}</th>
                    <th className="px-5 py-3.5">{t("referenceRange")}</th>
                    <th className="px-5 py-3.5">{t("interpretation")}</th>
                    <th className="px-5 py-3.5">{t("verificationStatus")}</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {observations.map((obs) => {
                    const status = compareToSourceRange(obs.value, obs.referenceRange);
                    return (
                      <tr key={obs.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-4 font-semibold text-[#172B3A]">
                          {obs.name}
                        </td>
                        <td className="px-5 py-4 font-bold text-[#172B3A]">
                          {obs.value}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-600">
                          {obs.unit || "—"}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-600">
                          {obs.referenceRange || "Not provided in source"}
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <span
                            className={`px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 ${
                              status === "in_range"
                                ? "bg-emerald-100 text-emerald-800"
                                : status === "out_of_range"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {status === "in_range" && <Check className="w-3 h-3" />}
                            {status === "out_of_range" && <AlertCircle className="w-3 h-3" />}
                            {rangeLabel(status)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <span
                            className={`px-2.5 py-1 rounded-full font-medium ${
                              obs.verificationStatus === "confirmed"
                                ? "bg-teal-100 text-teal-800"
                                : "bg-amber-50 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {obs.verificationStatus === "confirmed" ? "Confirmed" : "Needs Review"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {obs.verificationStatus !== "confirmed" ? (
                            <button
                              type="button"
                              onClick={() => handleConfirmObservation(obs.id)}
                              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Confirm
                            </button>
                          ) : (
                            <span className="text-xs text-teal-700 font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                            </span>
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

        {/* Clinical Plain-Language Guidance */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#087F72]" />
            <h3 className="font-bold text-base text-[#172B3A]">
              How to Interpret Your Results
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs text-gray-600 leading-relaxed">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
              <h5 className="font-bold text-[#172B3A]">1. Reference Ranges</h5>
              <p>Reference ranges are specific to the testing laboratory and equipment used. Never compare across labs without clinical advice.</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
              <h5 className="font-bold text-[#172B3A]">2. Values Outside Range</h5>
              <p>An out-of-range value is not by itself a diagnosis. Hydration, time of day, diet, and medications frequently influence lab results.</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
              <h5 className="font-bold text-[#172B3A]">3. Questions for Your Doctor</h5>
              <p>Ask: &ldquo;Do any of these results require a repeat test, dietary change, or follow-up consultation?&rdquo;</p>
            </div>
          </div>
        </div>

        {/* Add Observation Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <h3 className="text-lg font-bold text-[#172B3A]">
                {t("addManualObservation")}
              </h3>
              <p className="text-xs text-gray-500">
                Copy the test name and result exactly as printed on your paper report.
              </p>

              <form onSubmit={handleAddManualObservation} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t("testName")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Hemoglobin, Platelet Count, HbA1c"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t("result")} *
                    </label>
                    <input
                      type="text"
                      required
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="e.g. 13.5"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {t("unit")}
                    </label>
                    <input
                      type="text"
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      placeholder="e.g. g/dL, mg/dL"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t("referenceRange")} (if printed)
                  </label>
                  <input
                    type="text"
                    value={newRange}
                    onChange={(e) => setNewRange(e.target.value)}
                    placeholder="e.g. 12.0-15.0 or <100"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    {common("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={savingObs}
                    className="px-4 py-2 rounded-xl bg-[#087F72] hover:bg-[#06665B] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {savingObs ? common("loading") : common("save")}
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