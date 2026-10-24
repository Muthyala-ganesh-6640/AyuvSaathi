"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
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
  BellRing,
  AlertCircle,
  StopCircle,
  Edit2,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/utils";

interface DoseItem {
  id: string;
  medicationId: string;
  medicationName: string;
  strength?: string;
  instructions?: string;
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
  startDate?: string;
  endDate?: string;
  schedule?: {
    id: string;
    times: string[];
    startDate: string;
    endDate?: string;
    enabled: boolean;
  } | null;
}

interface AppointmentItem {
  id: string;
  title: string;
  facility?: string;
  startsAt: string;
  status: "scheduled" | "completed" | "cancelled";
  notes?: string;
}

export default function RemindersPage() {
  const t = useTranslations("reminders");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [doses, setDoses] = useState<DoseItem[]>([]);
  const [medications, setMedications] = useState<MedicationWithSchedule[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add medication modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [instructions, setInstructions] = useState("");
  const [times, setTimes] = useState("09:00, 21:00");
  const [duration, setDuration] = useState("14 days");
  const [saving, setSaving] = useState(false);

  // Edit medication modal
  const [editingMed, setEditingMed] = useState<MedicationWithSchedule | null>(null);
  const [editName, setEditName] = useState("");
  const [editStrength, setEditStrength] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editTimes, setEditTimes] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const fetchReminders = useCallback(async () => {
    try {
      const [dashRes, medsRes, apptRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/medications"),
        fetch("/api/appointments"),
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
      if (apptRes.ok) {
        const json = await apptRes.json();
        setAppointments(json.appointments || []);
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

  const handleSnoozeDose = async (doseId: string, snoozeMinutes: number) => {
    try {
      const res = await fetch(`/api/doses/${doseId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snoozeMinutes }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `Dose snoozed by ${snoozeMinutes} mins!`);
        fetchReminders();
      } else {
        toast.error("Failed to snooze dose");
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

  const handleStopCourse = async (med: MedicationWithSchedule) => {
    if (!confirm(`Stop reminders for ${med.name}? This marks the treatment course as completed.`)) return;
    try {
      const res = await fetch(`/api/medications/${med.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        toast.success(`Course completed. Reminders stopped for ${med.name}.`);
        fetchReminders();
      } else {
        toast.error("Failed to stop reminders");
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

  const openEditModal = (med: MedicationWithSchedule) => {
    setEditingMed(med);
    setEditName(med.name);
    setEditStrength(med.strength);
    setEditInstructions(med.instructions);
    setEditTimes(med.schedule?.times.join(", ") || "09:00");
    setEditEndDate(med.endDate || med.schedule?.endDate || "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMed) return;

    const timesArray = editTimes
      .split(",")
      .map((t) => t.trim())
      .filter((t) => /^\d{2}:\d{2}$/.test(t));

    try {
      const res = await fetch(`/api/medications/${editingMed.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editName,
          strength: editStrength,
          instructions: editInstructions,
          times: timesArray.length > 0 ? timesArray : editingMed.schedule?.times,
          endDate: editEndDate || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Reminder schedule updated!");
        setEditingMed(null);
        fetchReminders();
      } else {
        toast.error("Failed to update reminder schedule");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const upcomingAppts = appointments.filter((a) => a.status === "scheduled");

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#DDF5F0] text-[#087F8C]">
                <BellRing className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#17344F] tracking-tight">
                Medication & Appointment Reminders
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#61768A]">
              Timely, personalized alerts built from your clinical prescriptions and care visits.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#087F8C] hover:bg-[#07545B] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Medicine
            </button>
            <Link
              href="/appointments"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            >
              <Calendar className="w-4 h-4 text-teal-600" /> New Consult
            </Link>
          </div>
        </div>

        {/* Section 1: Upcoming Appointments & Follow-ups */}
        <div className="bg-white rounded-2xl border border-[#E1EBF0] shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E9F0F3] pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-sm sm:text-base text-[#17344F]">
                Scheduled Appointments & Clinical Follow-ups
              </h3>
            </div>
            <span className="text-xs text-blue-700 bg-blue-50 font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
              {upcomingAppts.length} Upcoming
            </span>
          </div>

          {upcomingAppts.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500 space-y-1">
              <p>No pending doctor consultations or follow-up visits scheduled.</p>
              <Link href="/appointments" className="text-teal-700 font-semibold hover:underline inline-block">
                + Schedule an appointment or record doctor follow-up
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcomingAppts.map((appt) => (
                <div
                  key={appt.id}
                  className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 hover:bg-blue-50/70 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase">
                        Consult
                      </span>
                      <h4 className="font-bold text-sm text-[#17344F]">{appt.title}</h4>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      📍 {appt.facility || "Authorized Medical Centre"}
                    </p>
                    <p className="text-xs text-blue-800 font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDateTime(appt.startsAt, locale)}
                    </p>
                    {appt.notes && (
                      <p className="text-[11px] text-slate-500 pt-1 italic line-clamp-1">
                        &quot;{appt.notes}&quot;
                      </p>
                    )}
                  </div>
                  <Link
                    href="/appointments"
                    className="p-2 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors shrink-0"
                    title="Manage Appointment"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Today's Medication Doses (Confirm / Snooze / Skip) */}
        <div className="bg-white rounded-2xl border border-[#E1EBF0] shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E9F0F3] pb-3">
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-teal-600" />
              <h3 className="font-bold text-sm sm:text-base text-[#17344F]">
                Today&apos;s Medicine Schedule & Dosage Alerts
              </h3>
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
                className="text-[#087F72] font-semibold hover:underline inline-block cursor-pointer"
              >
                + Add your first medicine reminder
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {doses.map((dose) => (
                <div
                  key={dose.id}
                  className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
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
                        {dose.strength && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-semibold border border-teal-200">
                            {dose.strength}
                          </span>
                        )}
                        {dose.synthetic && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                            Demo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {dose.instructions || `Scheduled daily dose for ${dose.scheduledTime}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {dose.status === "pending" ? (
                      <>
                        {/* Confirm Taken */}
                        <button
                          type="button"
                          onClick={() => handleUpdateDose(dose.id, "taken")}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Taken
                        </button>

                        {/* Snooze 15m */}
                        <button
                          type="button"
                          onClick={() => handleSnoozeDose(dose.id, 15)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title="Snooze reminder by 15 minutes"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-600" /> +15m
                        </button>

                        {/* Snooze 30m */}
                        <button
                          type="button"
                          onClick={() => handleSnoozeDose(dose.id, 30)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title="Snooze reminder by 30 minutes"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-600" /> +30m
                        </button>

                        {/* Skip */}
                        <button
                          type="button"
                          onClick={() => handleUpdateDose(dose.id, "skipped")}
                          className="px-2.5 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Skip
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

        {/* Section 3: All Prescribed Medications & Courses */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-base text-[#172B3A] flex items-center gap-2">
              <Pill className="w-5 h-5 text-indigo-700" />
              Active Prescriptions & Treatment Courses
            </h3>
            <span className="text-xs text-gray-500 font-medium">
              {medications.length} registered
            </span>
          </div>

          {medications.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">
              No registered medications found. Upload a prescription or add your medicines above.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {medications.map((med) => {
                const isCompleted = med.status === "completed";
                return (
                  <div
                    key={med.id}
                    className={`p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                      isCompleted ? "bg-slate-50/80 opacity-75" : "hover:bg-gray-50/60"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-base text-[#172B3A]">{med.name}</h4>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-[#087F72] font-semibold border border-teal-200">
                          {med.strength}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full capitalize font-medium ${
                            med.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : med.status === "completed"
                              ? "bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {med.status === "completed" ? "Course Ended" : med.status}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600">{med.instructions}</p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 pt-0.5">
                        {med.schedule && (
                          <span>Daily Times: <strong>{med.schedule.times.join(", ")}</strong></span>
                        )}
                        {med.endDate && (
                          <span>Course Duration: ends on <strong>{med.endDate}</strong></span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                      {/* Edit Reminder */}
                      <button
                        type="button"
                        onClick={() => openEditModal(med)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                        title="Edit Reminder Schedule"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" /> Edit
                      </button>

                      {/* Pause / Resume */}
                      {med.status !== "completed" && (
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
                      )}

                      {/* Stop Reminders / Course Ended */}
                      {med.status !== "completed" && (
                        <button
                          type="button"
                          onClick={() => handleStopCourse(med)}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-semibold text-rose-700 inline-flex items-center gap-1.5 cursor-pointer"
                          title="Stop reminders for this course"
                        >
                          <StopCircle className="w-3.5 h-3.5" /> Stop Course
                        </button>
                      )}

                      {/* Delete */}
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
                );
              })}
            </div>
          )}
        </div>

        {/* Add Medication Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <h3 className="text-lg font-bold text-[#172B3A]">Add Medicine Reminder</h3>
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
                    placeholder="e.g. Metformin, Telmisartan"
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
                    placeholder="e.g. 500 mg, 1 tablet"
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
                    placeholder="e.g. Take after food with water"
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

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Course Duration
                  </label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 7 days, 14 days, 30 days"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
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

        {/* Edit Medication Modal */}
        {editingMed && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <h3 className="text-lg font-bold text-[#172B3A]">Edit Reminder Schedule</h3>
              <p className="text-xs text-gray-500">
                Update timing, instructions, or course duration for {editingMed.name}.
              </p>

              <form onSubmit={handleSaveEdit} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Medicine Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-teal-600 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Strength / Dosage
                  </label>
                  <input
                    type="text"
                    required
                    value={editStrength}
                    onChange={(e) => setEditStrength(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-teal-600 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Daily Schedule Times (24h comma-separated)
                  </label>
                  <input
                    type="text"
                    required
                    value={editTimes}
                    onChange={(e) => setEditTimes(e.target.value)}
                    placeholder="09:00, 21:00"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-teal-600 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Course End Date (optional)
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-teal-600 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Instructions
                  </label>
                  <input
                    type="text"
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-teal-600 outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingMed(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Save Changes
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
