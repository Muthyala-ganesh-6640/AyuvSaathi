"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";

interface AppointmentItem {
  id: string;
  title: string;
  facility?: string;
  startsAt: string;
  status: "scheduled" | "completed" | "cancelled";
  notes?: string;
}

export default function AppointmentsPage() {
  const t = useTranslations("appointments");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New appointment modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [facility, setFacility] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch("/api/appointments");
      if (res.status === 401) {
        router.push("/auth/sign-in");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setAppointments(json.appointments || []);
      }
    } catch {
      toast.error("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !dateTime) {
      toast.error("Title and date/time are required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          facility,
          startsAt: new Date(dateTime).toISOString(),
          notes,
        }),
      });
      if (res.ok) {
        toast.success("Appointment scheduled!");
        setShowModal(false);
        setTitle("");
        setFacility("");
        setDateTime("");
        setNotes("");
        fetchAppointments();
      } else {
        toast.error("Failed to schedule appointment");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: "completed" | "cancelled") => {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(`Marked as ${status}`);
        fetchAppointments();
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this appointment?")) return;
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Appointment deleted");
        setAppointments((prev) => prev.filter((a) => a.id !== id));
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
                <Calendar className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#17344F] tracking-tight">
                Scheduled Appointments & Consults
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#61768A]">
              Keep track of doctor consultations, lab tests, and hospital follow-up visits.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#087F8C] hover:bg-[#07545B] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> {t("addNew")}
          </button>
        </div>

        {/* Appointments List */}
        <div className="bg-white rounded-xl border border-[#E1EBF0] shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E9F0F3] flex items-center justify-between">
            <h3 className="font-bold text-sm sm:text-base text-[#17344F] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#087F8C]" />
              Scheduled Consultations & Tests
            </h3>
            <span className="text-xs text-gray-500 font-medium">
              {appointments.length} record{appointments.length === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">{common("loading")}</div>
          ) : appointments.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500 space-y-2">
              <p>{t("noAppointments")}</p>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="text-[#087F72] font-semibold hover:underline inline-block text-xs"
              >
                + Schedule an appointment
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {appointments.map((appt) => (
                <div
                  key={appt.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/60 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-[#172B3A]">{appt.title}</h4>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full capitalize font-medium ${
                          appt.status === "scheduled"
                            ? "bg-purple-100 text-purple-800"
                            : appt.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {appt.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {formatDateTime(appt.startsAt, locale)}
                      </span>
                      {appt.facility && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          {appt.facility}
                        </span>
                      )}
                    </div>

                    {appt.notes && (
                      <p className="text-xs text-gray-500 pt-0.5 leading-relaxed">
                        Notes: {appt.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {appt.status === "scheduled" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(appt.id, "completed")}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-emerald-50 hover:text-emerald-700 text-xs font-semibold text-gray-700 inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Completed
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(appt.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Appointment Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <h3 className="text-lg font-bold text-[#172B3A]">{t("addNew")}</h3>
              <p className="text-xs text-gray-500">
                Record an upcoming doctor visit or lab diagnostic appointment.
              </p>

              <form onSubmit={handleCreateAppointment} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Appointment Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Cardiologist Follow-up or Fasting Blood Test"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t("facility")}
                  </label>
                  <input
                    type="text"
                    value={facility}
                    onChange={(e) => setFacility(e.target.value)}
                    placeholder="e.g. Apollo Hospitals / Care Clinic"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t("dateTime")} *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t("notes")}
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Remember to fast for 8 hours before test"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden resize-none"
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
