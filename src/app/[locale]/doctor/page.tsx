"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { QRScannerModal } from "@/components/qr/QRScannerModal";
import { toast } from "sonner";
import {
  Stethoscope,
  QrCode,
  Users,
  FileText,
  Pill,
  MessageSquare,
  AlertTriangle,
  Building,
  UserCheck,
  Plus,
  Send,
  Clock,
  CheckCircle2,
  Calendar,
  Activity,
  ArrowRight,
  ShieldCheck,
  Search,
} from "lucide-react";

export default function DoctorDashboardPage() {
  const currentLocale = useLocale();
  const router = useRouter();

  const [doctorUser, setDoctorUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientData, setPatientData] = useState<any>(null);

  // Scanner modal
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"overview" | "patients" | "prescribe" | "comms" | "emergency" | "profile">("overview");

  // Prescription creation form state
  const [diagnosis, setDiagnosis] = useState("");
  const [prescNotes, setPrescNotes] = useState("");
  const [prescItems, setPrescItems] = useState([
    { medicineName: "Amoxicillin", dosage: "500 mg", frequency: "Twice daily after meals", duration: "5 days", instructions: "Complete full antibiotic course" },
  ]);
  const [savingPrescription, setSavingPrescription] = useState(false);

  // Communication message state
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [sendingMsg, setSendingMsg] = useState(false);

  // Load doctor profile and active connections
  const loadDoctorData = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!res.ok || !data.user) {
        toast.error("Please sign in as a doctor.");
        window.location.href = `/${currentLocale}/auth/professional?role=doctor`;
        return;
      }
      setDoctorUser(data.user);

      // Fetch doctor's connected patients
      const connRes = await fetch("/api/connections");
      const connData = await connRes.json();
      if (connData.ok) {
        setConnections(connData.connections || []);
      }
    } catch {
      toast.error("Failed to load doctor workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctorData();
  }, []);

  // When a patient is scanned or selected
  const handlePatientResolved = (data: any) => {
    setSelectedPatient(data.patient);
    setPatientData(data);
    setActiveTab("overview");
    loadMessages(data.patient.id);
    loadDoctorData();
  };

  const loadMessages = async (patientProfileId: string) => {
    try {
      const res = await fetch(`/api/professional/messages?patientProfileId=${encodeURIComponent(patientProfileId)}`);
      const d = await res.json();
      if (d.ok) {
        setMessages(d.messages || []);
      }
    } catch {
      // ignore
    }
  };

  const addPrescriptionItem = () => {
    setPrescItems([
      ...prescItems,
      { medicineName: "", dosage: "", frequency: "Once daily", duration: "7 days", instructions: "After meals" },
    ]);
  };

  const removePrescriptionItem = (index: number) => {
    if (prescItems.length <= 1) return;
    setPrescItems(prescItems.filter((_, i) => i !== index));
  };

  const updatePrescItem = (index: number, field: string, val: string) => {
    const updated = [...prescItems];
    updated[index] = { ...updated[index], [field]: val };
    setPrescItems(updated);
  };

  const handleCreatePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error("Please scan or select a patient first.");
      return;
    }
    const invalid = prescItems.some((i) => !i.medicineName || !i.dosage);
    if (invalid) {
      toast.error("Please complete all medicine names and dosages.");
      return;
    }

    setSavingPrescription(true);
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientProfileId: selectedPatient.id,
          diagnosis,
          notes: prescNotes,
          items: prescItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create prescription.");
      } else {
        toast.success("Prescription generated & synchronized with patient dashboard!");
        // Update local patient data view
        if (patientData) {
          setPatientData({
            ...patientData,
            prescriptions: [data.prescription, ...(patientData.prescriptions || [])],
          });
        }
        setActiveTab("overview");
      }
    } catch {
      toast.error("Network error while submitting prescription.");
    } finally {
      setSavingPrescription(false);
    }
  };

  const handleSendMessage = async (isEmergency = false) => {
    if (!selectedPatient || !messageText.trim()) return;
    setSendingMsg(true);
    try {
      const res = await fetch("/api/professional/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientProfileId: selectedPatient.id,
          professionalId: doctorUser.id,
          message: messageText.trim(),
          isEmergency,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success(isEmergency ? "Emergency broadcast sent to patient!" : "Message sent to patient.");
        setMessageText("");
        setMessages([...messages, d.message]);
      } else {
        toast.error(d.error || "Failed to send message.");
      }
    } catch {
      toast.error("Network error sending message.");
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="py-20 text-center text-slate-500 text-sm">
          Loading authorized Doctor Workspace...
        </div>
      </AppShell>
    );
  }

  const doc = doctorUser?.doctorProfile;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto w-full py-6 px-4 sm:px-6 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-blue-200 border border-white/20">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{doctorUser?.displayName || "Dr. Srinivas Rao"}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Verified Doctor
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                {doc?.specialization || "General Medicine"} • {doc?.hospitalClinicName || "Apollo Health City"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-105"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan Patient QR</span>
          </button>
        </div>

        {/* Selected Patient Banner if active */}
        {selectedPatient && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-950">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-sm">
                {selectedPatient.name.slice(0, 1)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#17344F]">{selectedPatient.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-semibold">
                    {selectedPatient.ayuvSaathiId}
                  </span>
                  {selectedPatient.relationship !== "self" && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold uppercase">
                      {selectedPatient.relationship}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Authorized Patient Workspace Active • Role-based data consent verified
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("prescribe")}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                + Write Prescription
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("comms")}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Send Message
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-2">
          {[
            { id: "overview", label: "Overview & Records", icon: Activity },
            { id: "patients", label: `Connected Patients (${connections.length})`, icon: Users },
            { id: "prescribe", label: "Create Prescription", icon: Pill },
            { id: "comms", label: "Patient Messages", icon: MessageSquare },
            { id: "emergency", label: "Doctor Emergency Channel", icon: AlertTriangle },
            { id: "profile", label: "Doctor Profile", icon: UserCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? "bg-[#17344F] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Overview & Patient Records */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {!selectedPatient ? (
              <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#17344F]">No Active Patient Selected</h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Scan the patient's Universal Health QR code to securely load authorized laboratory reports, active medications, and medical records.
                </p>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Scan Patient QR Code</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Column 1: Lab Reports */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <h3 className="text-sm font-bold text-[#17344F]">Authorized Lab Reports</h3>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                      {patientData?.documents?.length || 0}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {patientData?.documents?.length ? (
                      patientData.documents.map((d: any) => (
                        <div key={d.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                          <div className="font-semibold text-slate-800">{d.displayName}</div>
                          <div className="text-[10px] text-slate-500">
                            {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "Recent"} • {d.processingStatus}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 py-3 text-center">No reports uploaded yet.</p>
                    )}
                  </div>
                </div>

                {/* Column 2: Observations / Biomarkers */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-sm font-bold text-[#17344F]">Extracted Biomarkers</h3>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      {patientData?.observations?.length || 0}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {patientData?.observations?.length ? (
                      patientData.observations.map((obs: any) => (
                        <div key={obs.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-800">{obs.name}</div>
                            <div className="text-[10px] text-slate-500">Ref: {obs.referenceRange || "Normal"}</div>
                          </div>
                          <div className="font-mono font-bold text-teal-800">
                            {obs.value} {obs.unit}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 py-3 text-center">No biomarkers recorded.</p>
                    )}
                  </div>
                </div>

                {/* Column 3: Active Medications */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pill className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-[#17344F]">Active Medications</h3>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {patientData?.medications?.length || 0}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {patientData?.medications?.length ? (
                      patientData.medications.map((m: any) => (
                        <div key={m.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-0.5">
                          <div className="font-semibold text-slate-800">{m.name} ({m.strength})</div>
                          <div className="text-[10px] text-slate-500">{m.instructions}</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 py-3 text-center">No active medications.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Connected Patients */}
        {activeTab === "patients" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-[#17344F]">Authorized Patient Connections</h3>
            {connections.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No connected patients yet. Scan a patient's QR code to establish authorization.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {connections.map((conn) => (
                  <div key={conn.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-800">Patient ID: {conn.patientProfileId}</div>
                      <div className="text-xs text-slate-500">
                        Connected: {new Date(conn.createdAt).toLocaleDateString()} • Status: {conn.status}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatient({ id: conn.patientProfileId, name: "Authorized Patient", ayuvSaathiId: "AS-P-CONNECTED" });
                        setActiveTab("overview");
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 cursor-pointer"
                    >
                      Open Workspace →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Create Prescription Form */}
        {activeTab === "prescribe" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#17344F]">Create Clinical Prescription</h3>
              <p className="text-xs text-slate-600">
                Prescriptions automatically propagate to the patient's active medications, reminders, and timeline.
              </p>
            </div>

            {!selectedPatient ? (
              <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                <span>Please scan or select an authorized patient before prescribing.</span>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs"
                >
                  Scan QR
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreatePrescription} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Patient
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`${selectedPatient.name} (${selectedPatient.ayuvSaathiId})`}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 border border-slate-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Clinical Diagnosis / Symptoms
                    </label>
                    <input
                      type="text"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="e.g. Acute Pharyngitis, Mild Hypertension"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-teal-600 outline-hidden"
                    />
                  </div>
                </div>

                {/* Medicine Items */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Prescribed Medicines ({prescItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={addPrescriptionItem}
                      className="flex items-center gap-1 text-xs text-teal-700 hover:text-teal-900 font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Medicine</span>
                    </button>
                  </div>

                  {prescItems.map((item, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Item #{idx + 1}</span>
                        {prescItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePrescriptionItem(idx)}
                            className="text-[11px] text-red-600 hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <input
                          type="text"
                          required
                          value={item.medicineName}
                          onChange={(e) => updatePrescItem(idx, "medicineName", e.target.value)}
                          placeholder="Medicine name (e.g. Paracetamol)"
                          className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:border-teal-600"
                        />
                        <input
                          type="text"
                          required
                          value={item.dosage}
                          onChange={(e) => updatePrescItem(idx, "dosage", e.target.value)}
                          placeholder="Dosage (e.g. 650 mg)"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:border-teal-600"
                        />
                        <input
                          type="text"
                          value={item.frequency}
                          onChange={(e) => updatePrescItem(idx, "frequency", e.target.value)}
                          placeholder="Frequency (e.g. TID)"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:border-teal-600"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={item.duration}
                          onChange={(e) => updatePrescItem(idx, "duration", e.target.value)}
                          placeholder="Duration (e.g. 5 days)"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:border-teal-600"
                        />
                        <input
                          type="text"
                          value={item.instructions}
                          onChange={(e) => updatePrescItem(idx, "instructions", e.target.value)}
                          placeholder="Instructions (e.g. After food)"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:border-teal-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Doctor's Clinical Advice & Follow-Up
                  </label>
                  <textarea
                    rows={2}
                    value={prescNotes}
                    onChange={(e) => setPrescNotes(e.target.value)}
                    placeholder="e.g. Drink plenty of warm fluids, return in 5 days if fever persists."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-teal-600 outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingPrescription}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#087F72] hover:bg-[#06665B] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingPrescription ? "Synchronizing Prescription..." : "Issue & Synchronize Clinical Prescription"}</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* Tab 4: Patient Communications */}
        {activeTab === "comms" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-[#17344F]">Direct Doctor-Patient Communication</h3>
            {!selectedPatient ? (
              <p className="text-xs text-slate-500">Please select an active patient to exchange communications.</p>
            ) : (
              <div className="space-y-4">
                <div className="h-64 overflow-y-auto p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-400">
                      No communications yet with {selectedPatient.name}.
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl max-w-sm text-xs ${
                          m.senderRole === "doctor"
                            ? "ml-auto bg-blue-600 text-white"
                            : "mr-auto bg-white border border-slate-200 text-slate-800"
                        }`}
                      >
                        <div className="font-bold text-[10px] opacity-80 mb-0.5">{m.senderName}</div>
                        <div>{m.message}</div>
                        <div className="text-[9px] opacity-70 mt-1 text-right">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type a clinical instruction or note..."
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-teal-600 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendMessage(false)}
                    disabled={sendingMsg || !messageText.trim()}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Doctor Emergency Communication (with mandated disclaimer) */}
        {activeTab === "emergency" && (
          <div className="bg-white rounded-2xl border border-red-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-red-900">Doctor Emergency Communication Channel</h3>
                <p className="text-xs text-slate-600">Urgent high-priority alert direct to patient device</p>
              </div>
            </div>

            {/* MANDATORY LEGAL & CLINICAL DISCLAIMER */}
            <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs space-y-1.5 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-red-800">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>CRITICAL DISTINCTION: Doctor Emergency Communication vs Official Emergency Services</span>
              </div>
              <p>
                This channel alerts the connected patient's AyuvSaathi app with an emergency priority badge.
                <strong> This does NOT dispatch ambulances or contact national emergency response authorities.</strong>
              </p>
              <p className="text-[11px] font-semibold text-red-800">
                For immediate life-threatening situations, dial Indian National Emergency Services:
                <span className="font-bold underline ml-1">108 (Ambulance)</span> or <span className="font-bold underline">112 (National Emergency)</span>.
              </p>
            </div>

            {selectedPatient ? (
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-700">
                  Broadcast Urgent Clinical Alert to {selectedPatient.name}
                </label>
                <textarea
                  rows={3}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="e.g. Critical potassium levels detected on your latest lab report. Proceed immediately to the emergency triage at Apollo Hospital."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-red-300 focus:border-red-600 outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage(true)}
                  disabled={sendingMsg || !messageText.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Send Urgent Priority Alert</span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Scan or select a patient to activate the emergency channel.</p>
            )}
          </div>
        )}

        {/* Tab 6: Doctor Profile */}
        {activeTab === "profile" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-[#17344F]">Doctor Professional Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Full Name:</span>
                <span className="font-bold text-slate-800">{doctorUser?.displayName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Medical Registration No:</span>
                <span className="font-bold text-slate-800">{doc?.medicalRegistrationNumber || "MCI-48921-A"}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Specialization:</span>
                <span className="font-bold text-slate-800">{doc?.specialization}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Hospital / Clinic:</span>
                <span className="font-bold text-slate-800">{doc?.hospitalClinicName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Qualification:</span>
                <span className="font-bold text-slate-800">{doc?.qualification || "MBBS, MD"}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Consultation Availability:</span>
                <span className="font-bold text-slate-800">{doc?.consultationAvailability || "Mon - Sat"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Universal QR Scanner Modal */}
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onResolved={handlePatientResolved}
          portalRole="doctor"
        />
      </div>
    </AppShell>
  );
}
