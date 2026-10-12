"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  FileCheck2,
  Upload,
  Pill,
  Plus,
  ShieldAlert,
  ArrowRight,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface PrescriptionDoc {
  id: string;
  displayName: string;
  processingStatus: string;
  processingNote?: string;
  createdAt: string;
  prescriptionExtraction?: {
    prescriptionSummary?: string;
    translatedSummary?: string;
    sourceLanguage?: string;
    doctorName?: string;
    patientNamePrinted?: string;
    reportDate?: string;
    overallConfidence?: number;
    handwritingDetected?: boolean;
    unreadableRegions?: string[];
    medications?: {
      name: string;
      strength?: string;
      instructions?: string;
      route?: string;
      frequency?: string;
      uncertain?: boolean;
      handwriting?: boolean;
    }[];
  } | null;
}

interface MedicationItem {
  id: string;
  name: string;
  strength: string;
  instructions: string;
  route?: string;
  status: string;
  confirmationStatus: string;
  provenance: string;
}

export default function PrescriptionsPage() {
  const t = useTranslations("prescriptions");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [prescriptions, setPrescriptions] = useState<PrescriptionDoc[]>([]);
  const [medications, setMedications] = useState<MedicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual medication entry modal
  const [showModal, setShowModal] = useState(false);
  const [medName, setMedName] = useState("");
  const [strength, setStrength] = useState("");
  const [instructions, setInstructions] = useState("");
  const [times, setTimes] = useState("09:00, 21:00");
  const [savingMed, setSavingMed] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [docsRes, medsRes] = await Promise.all([
        fetch("/api/documents"),
        fetch("/api/medications"),
      ]);

      if (docsRes.status === 401 || medsRes.status === 401) {
        router.push("/auth/sign-in");
        return;
      }

      if (docsRes.ok) {
        const json = await docsRes.json();
        setPrescriptions(
          json.documents.filter((d: { category: string }) => d.category === "prescription")
        );
      }
      if (medsRes.ok) {
        const json = await medsRes.json();
        setMedications(json.medications);
      }
    } catch {
      toast.error("Failed to load prescription data");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUploadPrescription = async (file: File) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "prescription");
    formData.append("language", locale);

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
        if (data.document?.processingStatus === "failed" || data.document?.processingStatus === "unconfigured") {
          toast.error(data.notes?.[0] || t("analysisUnavailable"));
        } else {
          toast.success("Prescription uploaded. Review all extracted medicine details.");
        }
        await fetchData();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setUploading(false);
    }
  };

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName || !strength || !instructions) {
      toast.error("Please enter medicine name, strength, and instructions.");
      return;
    }

    const timesArray = times
      .split(",")
      .map((t) => t.trim())
      .filter((t) => /^\d{2}:\d{2}$/.test(t));

    setSavingMed(true);
    try {
      const res = await fetch("/api/medications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: medName,
          strength,
          instructions,
          times: timesArray.length > 0 ? timesArray : ["09:00"],
          status: "active",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Medication schedule created!");
        setShowModal(false);
        setMedName("");
        setStrength("");
        setInstructions("");
        fetchData();
      } else {
        toast.error(data.error || "Failed to create medication");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSavingMed(false);
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
                <FileCheck2 className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#17344F] tracking-tight">
                {t("title")}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#61768A]">
              {t("subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#087F8C] hover:bg-[#07545B] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> {t("addToSchedules")}
            </button>
          </div>
        </div>

        {/* Clinical Safety Alert on Handwriting */}
        <div className="p-4 bg-[#FFF8EB] border border-[#E9A23B]/30 rounded-xl flex items-start gap-3 text-xs text-[#17344F]">
          <ShieldAlert className="w-5 h-5 text-[#E9A23B] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-[#17344F]">{t("handwritingAlert")}</h4>
            <p className="leading-relaxed text-[#61768A]">
              Prescription notes often contain handwriting abbreviations. AyuvSaathi flags uncertain symbols instead of guessing dosages. Always confirm schedules against your original doctor prescription or pharmacist.
            </p>
          </div>
        </div>

        {/* Prescription Upload Card */}
        <div className="bg-white rounded-xl border border-[#E1EBF0] shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E9F0F3] pb-3">
            <h3 className="font-bold text-sm sm:text-base text-[#17344F] flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-[#087F8C]" />
              {t("uploadPrescription")}
            </h3>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#087F72] text-center cursor-pointer transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                if (e.target.files?.[0]) handleUploadPrescription(e.target.files[0]);
              }}
            />
            <div className="space-y-2">
              <Upload className="w-8 h-8 text-[#087F72] mx-auto" />
              <p className="font-semibold text-sm text-[#172B3A]">
                {uploading ? "Analyzing prescription note..." : t("uploadPrescription")}
              </p>
              <p className="text-xs text-gray-500">PDF, PNG, JPEG up to 10MB</p>
            </div>
          </div>

          {prescriptions.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Scanned Prescription Notes ({prescriptions.length})
              </h4>
              <div className="space-y-2">
                {prescriptions.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-sky-700" />
                        <span className="font-semibold text-gray-800">{p.displayName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                        <span>{formatDate(p.createdAt, locale)}</span>
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">
                          {p.processingStatus.replaceAll("_", " ")}
                        </span>
                      </div>
                    </div>
                    {p.prescriptionExtraction ? (
                      <div className="grid gap-3 border-t border-gray-200 pt-3 md:grid-cols-2">
                        <p className="text-amber-800 md:col-span-2">
                          {t("analysisDisclaimer")}
                        </p>
                        {(p.prescriptionExtraction.doctorName ||
                          p.prescriptionExtraction.patientNamePrinted ||
                          p.prescriptionExtraction.reportDate) && (
                          <p className="text-gray-600 md:col-span-2">
                            {[
                              p.prescriptionExtraction.doctorName,
                              p.prescriptionExtraction.patientNamePrinted,
                              p.prescriptionExtraction.reportDate,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                        <section className="space-y-1">
                          <h5 className="font-bold text-[#17344F]">{t("originalSummary")}</h5>
                          <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
                            {p.prescriptionExtraction.prescriptionSummary || t("summaryUnavailable")}
                          </p>
                        </section>
                        <section className="space-y-1">
                          <h5 className="font-bold text-[#087F8C]">{t("translatedSummary")}</h5>
                          <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
                            {p.prescriptionExtraction.translatedSummary || t("translationUnavailable")}
                          </p>
                        </section>
                        {Boolean(p.prescriptionExtraction.medications?.length) && (
                          <section className="space-y-2 md:col-span-2">
                            <h5 className="font-bold text-[#17344F]">{t("detectedMedicines")}</h5>
                            <ul className="space-y-2">
                              {p.prescriptionExtraction.medications?.map((medicine, index) => (
                                <li
                                  key={`${medicine.name}-${index}`}
                                  className="rounded-lg border border-gray-200 bg-white p-3"
                                >
                                  <p className="font-semibold text-gray-800">
                                    {medicine.name}
                                    {medicine.strength ? ` — ${medicine.strength}` : ""}
                                    {(medicine.uncertain || medicine.handwriting) && (
                                      <span className="ml-2 font-normal text-amber-700">
                                        {t("needsReview")}
                                      </span>
                                    )}
                                  </p>
                                  {medicine.instructions && (
                                    <p className="mt-1 text-gray-600">{medicine.instructions}</p>
                                  )}
                                  <p className="mt-1 text-gray-500">
                                    {[medicine.route, medicine.frequency].filter(Boolean).join(" · ")}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}
                        {(p.prescriptionExtraction.handwritingDetected ||
                          Boolean(p.prescriptionExtraction.unreadableRegions?.length)) && (
                          <p className="text-amber-800 md:col-span-2">
                            {t("uncertainText")}
                            {p.prescriptionExtraction.unreadableRegions?.length
                              ? ` ${p.prescriptionExtraction.unreadableRegions.join(" · ")}`
                              : ""}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="border-t border-gray-200 pt-3 text-gray-600">
                        {p.processingNote || t("analysisUnavailable")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active Prescribed Medications */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-base text-[#172B3A] flex items-center gap-2">
              <Pill className="w-5 h-5 text-[#087F72]" />
              Prescribed Medications
            </h3>
            <span className="text-xs text-gray-500 font-medium">
              {medications.length} active medicine{medications.length === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">{common("loading")}</div>
          ) : medications.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500 space-y-2">
              <p>{t("emptyPrescriptions")}</p>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-50 text-[#087F72] border border-teal-200 font-semibold text-xs hover:bg-teal-100 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add First Medication
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {medications.map((med) => (
                <div key={med.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/60 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-[#172B3A]">{med.name}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-[#087F72] font-semibold border border-teal-200">
                        {med.strength}
                      </span>
                      {med.provenance === "synthetic_demo" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                          Demo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">{med.instructions}</p>
                    <div className="flex items-center gap-3 text-[11px] text-gray-400 pt-0.5">
                      <span className="capitalize">Route: {med.route || "oral"}</span>
                      <span>•</span>
                      <span className="capitalize">Status: {med.status}</span>
                    </div>
                  </div>

                  <Link
                    href="/reminders"
                    className="px-3.5 py-2 rounded-xl border border-gray-200 hover:border-[#087F72] text-xs font-semibold text-gray-700 hover:text-[#087F72] transition-colors inline-flex items-center gap-1.5 shrink-0 self-start sm:self-center"
                  >
                    View in Schedule <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Medication Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <h3 className="text-lg font-bold text-[#172B3A]">
                Add Prescribed Medication
              </h3>
              <p className="text-xs text-gray-500">
                Enter details exactly as written on your doctor&apos;s prescription note.
              </p>

              <form onSubmit={handleAddMedication} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t("medicationName")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                    placeholder="e.g. Paracetamol, Metformin, Amoxicillin"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t("strength")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    placeholder="e.g. 500 mg, 10 mg"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t("instructions")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. 1 tablet twice daily after meals for 5 days"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Reminder Times (24h, comma separated)
                  </label>
                  <input
                    type="text"
                    value={times}
                    onChange={(e) => setTimes(e.target.value)}
                    placeholder="09:00, 21:00"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    {common("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={savingMed}
                    className="px-4 py-2 rounded-xl bg-[#087F72] hover:bg-[#06665B] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {savingMed ? common("loading") : common("save")}
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
