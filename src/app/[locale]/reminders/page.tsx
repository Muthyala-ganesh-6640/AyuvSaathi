"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useCallback, useEffect, useState } from "react";
import {
  Pill,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Trash2,
  Pause,
  Play,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface DoseItem {
  id: string;
  medicationId: string;
  medicationName: string;
  scheduledTime: string;
  scheduledDate: string;
  status: "pending" | "taken" | "skipped" | "missed";
  synthetic?: boolean;
}

interface MedicationWithSchedule {
  id: string;
  name: string;
  strength: string;
  instructions: string;
  status: "active" | "paused" | "completed";
  schedule?: {
    times: string[];
    startDate: string;
  } | null;
}

export default function RemindersPage() {
  const t = useTranslations("reminders");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [doses, setDoses] = useState<DoseItem[]>([]);
  const [medications, setMedications] = useState<MedicationWithSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Add medication modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [instructions, setInstructions] = useState("");
  const [times, setTimes] = useState("09:00, 21:00");
  const [saving, setSaving] = useState(false);

  const fetchReminders = useCallback(async () => {
    try {
      const [dashRes, medsRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/medications"),
      ]);

      if (dashRes.status === 401 || medsRes.status === 401) {
        router.push("/auth/sign-in");
        return;
      }

      if (dashRes.ok) {
        const json = await dashRes.json();
        setDoses(json.medicines || []);
      }
      if (medsRes.ok) {
        const json = await medsRes.json();
        setMedications(json.medications || []);
      }
    } catch {
      toast.error("Failed to load reminders");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleUpdateDose = async (doseId: string, status: "taken" | "skipped") => {
    try {
      const res = await fetch(`/api/doses/${doseId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(`Dose marked as ${status}!`);
        fetchReminders();
      } else {
        toast.error("Could not update dose status");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleToggleMedStatus = async (med: MedicationWithSchedule) => {
    const newStatus = med.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/medications/${med.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Medication marked as ${newStatus}`);
        fetchReminders();
      } else {
        toast.error("Failed to update medication");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleDeleteMedication = async (medId: string) => {
    if (!confirm("Delete this medication and its reminder schedule?")) return;
    try {
      const res = await fetch(`/api/medications/${medId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Medication deleted");
        fetchReminders();
      } else {
        toast.error("Failed to delete");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleCreateMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !strength || !instructions) {
      toast.error("Please fill in name, strength, and instructions.");
      return;
    }

    const timesArray = times
      .split(",")
      .map((t) => t.trim())
      .filter((t) => /^\d{2}:\d{2}$/.test(t));

    setSaving(true);
    try {
      const res = await fetch("/api/medications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          strength,
          instructions,
          times: timesArray.length > 0 ? timesArray : ["09:00"],
          status: "active",
        }),
      });
      if (res.ok) {
        toast.success("Medication and reminders created!");
        setShowAddModal(false);
        setName("");
        setStrength("");
        setInstructions("");
        fetchReminders();
      } else {
        toast.error("Failed to create medication");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
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
                <Pill className="w-5 h-5" />
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
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#087F8C] hover:bg-[#07545B] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> {t("addNew")}
          </button>
        </div>

        {/* Today's Schedule Card */}
        <div className="bg-white rounded-xl border border-[#E1EBF0] shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E9F0F3] pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#087F8C]" />
              <h3 className="font-bold text-sm sm:text-base text-[#17344F]">{t("todaysSchedule")}</h3>
            </div>
            <span className="text-xs text-[#61768A] font-medium">
              {formatDate(new Date(), locale)}
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">{common("loading")}</div>
          ) : doses.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500 space-y-2">
              <p>No dose events scheduled for today.</p>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="text-[#087F72] font-semibold hover:underline inline-block"
              >
                + Add your first medicine reminder
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {doses.map((dose) => (
                <div
                  key={dose.id}
                  className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-gray-50 flex items-center justify-between gap-4 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-teal-100/70 text-[#087F72] flex items-center justify-center font-bold text-sm shrink-0">
                      {dose.scheduledTime}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-[#172B3A]">
                          {dose.medicationName}
                        </h4>
                        {dose.synthetic && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                            Demo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Scheduled for today at {dose.scheduledTime}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {dose.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdateDose(dose.id, "taken")}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> {t("takeDose")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateDose(dose.id, "skipped")}
                          className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> {t("skipDose")}
                        </button>
                      </>
                    ) : (
                      <span
                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 ${
                          dose.status === "taken"
                            ? "bg-emerald-100 text-emerald-800"
                            : dose.status === "skipped"
                            ? "bg-gray-200 text-gray-700"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {dose.status === "taken" && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {dose.status === "skipped" && <XCircle className="w-3.5 h-3.5" />}
                        {dose.status === "missed" && <Clock className="w-3.5 h-3.5" />}
                        {dose.status.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Prescribed Medications List */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-base text-[#172B3A] flex items-center gap-2">
              <Pill className="w-5 h-5 text-indigo-700" />
              {t("allMedications")}
            </h3>
            <span className="text-xs text-gray-500 font-medium">
              {medications.length} registered
            </span>
          </div>

          {medications.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">
              {t("noMedications")}
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
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full capitalize font-medium ${
                          med.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {med.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{med.instructions}</p>
                    {med.schedule && (
                      <p className="text-[11px] text-gray-400">
                        Scheduled times: {med.schedule.times.join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleToggleMedStatus(med)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs font-medium text-gray-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {med.status === "active" ? (
                        <>
                          <Pause className="w-3.5 h-3.5" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" /> Resume
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMedication(med.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete Medication"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Medication Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <h3 className="text-lg font-bold text-[#172B3A]">
                {t("addNew")}
              </h3>
              <p className="text-xs text-gray-500">
                Set up recurring daily reminders for your prescribed medicine.
              </p>

              <form onSubmit={handleCreateMedication} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Medicine Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Metformin, Amlodipine"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Strength / Dosage *
                  </label>
                  <input
                    type="text"
                    required
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    placeholder="e.g. 500 mg, 5 mg"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Instructions as Prescribed *
                  </label>
                  <input
                    type="text"
                    required
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Take 1 tablet after food"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Daily Dose Times (24h format, comma separated)
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
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
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
