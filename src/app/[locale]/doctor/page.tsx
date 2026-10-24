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
  const [accessiblePatients, setAccessiblePatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
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
      if (data.user.role !== "doctor") {
        toast.error("Access denied: You must be signed in as a Doctor.");
        window.location.href = `/${currentLocale}/dashboard`;
        return;
      }
      setDoctorUser(data.user);

      // Fetch doctor's connected patients
      const connRes = await fetch("/api/connections");
      const connData = await connRes.json();
      if (connData.ok) {
        setConnections(connData.connections || []);
      }

      // Load all accessible patients in the healthcare ecosystem
      setLoadingPatients(true);
      const patientsRes = await fetch("/api/professional/patients");
      const patientsData = await patientsRes.json();
      if (patientsData.ok) {
        setAccessiblePatients(patientsData.patients || []);
      }
    } catch {
      toast.error("Failed to load doctor workspace.");
    } finally {
      setLoading(false);
      setLoadingPatients(false);
    }
  };

  const selectPatientById = async (patientId: string) => {
    try {
      setLoadingPatients(true);
      const res = await fetch(`/api/professional/patients?patientId=${encodeURIComponent(patientId)}`);
      const d = await res.json();
      if (d.ok) {
        setSelectedPatient(d.patient);
        setPatientData(d);
        setActiveTab("overview");
        loadMessages(d.patient.id);
        toast.success(`Connected to patient ${d.patient.name}`);
      } else {
        toast.error(d.error || "Failed to load patient records");
      }
    } catch {
      toast.error("Error loading patient records");
    } finally {
      setLoadingPatients(false);
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
      <AppShell showSidebar={false}>
        <div className="py-20 text-center text-slate-500 text-sm">
          Loading authorized Doctor Workspace...
        </div>
      </AppShell>
    );
  }

  const doc = doctorUser?.doctorProfile;

  return (
    <AppShell showSidebar={false}>
      <div className="max-w-6xl mx-auto w-full py-6 px-4 sm:px-6 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#08193C] via-[#0C2353] to-[#08193C] text-white shadow-md border border-[#D4E1EE]/20">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-[#DDB549] border border-[#DDB549]/30">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{doctorUser?.displayName || "Dr. Srinivas Rao"}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DDB549]/15 text-[#DDB549] border border-[#DDB549]/30">
                  Verified Doctor
                </span>
              </div>
              <p className="text-xs text-[#D4E1EE] mt-0.5">
                {doc?.specialization || "General Medicine"} • {doc?.hospitalClinicName || "Apollo Health City"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DDB549] hover:bg-[#E5C25F] text-[#08193C] font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-105 focus-visible:outline-2 focus-visible:outline-[#08193C]"
          >
            <QrCode className="w-4 h-4 text-[#08193C]" />
            <span>Scan Patient QR</span>
          </button>
        </div>

        {/* Selected Patient Banner if active */}
        {selectedPatient && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#EDF3F7] border border-[#D4E1EE] text-[#08193C]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#08193C] text-[#DDB549] flex items-center justify-center font-bold text-sm">
                {selectedPatient.name.slice(0, 1)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#08193C]">{selectedPatient.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#08193C] border border-[#D4E1EE] font-semibold">
                    {selectedPatient.ayuvSaathiId}
                  </span>
                  {selectedPatient.relationship !== "self" && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#EDF3F7] text-[#465978] border border-[#D4E1EE] font-semibold uppercase">
                      {selectedPatient.relationship}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#465978] mt-0.5">
                  Authorized Patient Workspace Active • Role-based data consent verified
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className="px-3 py-1.5 rounded-lg bg-[#08193C] hover:bg-[#122958] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Authorized Charts</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("prescribe")}
                className="px-3 py-1.5 rounded-lg bg-[#DDB549] hover:bg-[#E5C25F] text-[#08193C] text-xs font-bold shadow-xs cursor-pointer"
              >
                + Write Prescription
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("comms")}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#EDF3F7] border border-[#D4E1EE] text-[#08193C] text-xs font-semibold cursor-pointer"
              >
                Send Message
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPatient(null);
                  setPatientData(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#EDF3F7] hover:bg-[#D4E1EE] text-[#465978] text-xs font-semibold cursor-pointer"
              >
                Switch Patient
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-2 border-b border-[#D4E1EE] pb-2">
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
                    ? "bg-[#08193C] text-white shadow-xs border-b-2 border-[#DDB549]"
                    : "text-[#465978] hover:bg-[#EDF3F7] hover:text-[#08193C]"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-[#DDB549]" : "text-[#465978]"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Overview & Patient Records */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {!selectedPatient ? (
              <div className="space-y-6">
                <div className="p-8 text-center rounded-2xl bg-white border border-[#D4E1EE] space-y-4 shadow-2xs">
                  <div className="w-12 h-12 rounded-xl bg-[#EDF3F7] text-[#08193C] border border-[#D4E1EE] flex items-center justify-center mx-auto">
                    <QrCode className="w-6 h-6 text-[#08193C]" />
                  </div>
                  <h3 className="text-base font-bold text-[#08193C]">No Active Patient Selected</h3>
                  <p className="text-xs text-[#465978] max-w-md mx-auto">
                    Scan the patient's Universal Health QR code or select an authorized patient profile below to review shared clinical records, lab results, and medications.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#08193C] hover:bg-[#122958] text-white text-xs font-bold shadow-md cursor-pointer transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-[#DDB549]"
                  >
                    <QrCode className="w-4 h-4 text-[#DDB549]" />
                    <span>Scan Patient QR Code</span>
                  </button>
                </div>

                {/* Patient Directory for quick clinical record review */}
                <div className="bg-white rounded-2xl border border-[#D4E1EE] p-5 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-[#D4E1EE] pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-[#08193C]">Authorized Patient Network Directory</h4>
                      <p className="text-xs text-[#465978]">Select any patient below to access their synchronized medical charts and lab analyses</p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#EDF3F7] text-[#08193C] border border-[#D4E1EE]">
                      {accessiblePatients.length} Patients
                    </span>
                  </div>

                  {loadingPatients ? (
                    <div className="py-6 text-center text-xs text-[#9AA5B4]">Loading authorized patient directory...</div>
                  ) : accessiblePatients.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[#9AA5B4]">No patient profiles registered yet.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {accessiblePatients.map((p) => (
                        <div
                          key={p.id}
                          className="p-4 rounded-xl border border-[#D4E1EE] hover:border-[#DDB549] bg-[#FDFEFE] hover:bg-[#EDF3F7] transition-all flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-[#08193C]">{p.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EDF3F7] text-[#08193C] border border-[#D4E1EE] font-semibold">
                                {p.ayuvSaathiId}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#465978] flex items-center gap-3">
                              <span>📄 {p.documentsCount || 0} Reports</span>
                              <span>💊 {p.prescriptionsCount || 0} Prescriptions</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => selectPatientById(p.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#08193C] hover:bg-[#122958] text-white text-xs font-semibold cursor-pointer transition-colors shadow-2xs focus-visible:outline-2 focus-visible:outline-[#DDB549]"
                          >
                            Open Records →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Column 1: Lab Reports */}
                <div className="p-5 rounded-2xl bg-white border border-[#D4E1EE] shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#08193C]" />
                      <h3 className="text-sm font-bold text-[#08193C]">Authorized Lab Reports</h3>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EDF3F7] text-[#08193C] border border-[#D4E1EE]">
                      {patientData?.documents?.length || 0}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {patientData?.documents?.length ? (
                      patientData.documents.map((d: any) => (
                        <div key={d.id} className="p-3 rounded-xl bg-[#FDFEFE] border border-[#D4E1EE] text-xs space-y-1">
                          <div className="font-semibold text-[#08193C]">{d.displayName}</div>
                          <div className="text-[10px] text-[#465978]">
                            {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "Recent"} • {d.processingStatus}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#9AA5B4] py-3 text-center">No reports uploaded yet.</p>
                    )}
                  </div>
                </div>

                {/* Column 2: Observations / Biomarkers */}
                <div className="p-5 rounded-2xl bg-white border border-[#D4E1EE] shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#08193C]" />
                      <h3 className="text-sm font-bold text-[#08193C]">Extracted Biomarkers</h3>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EDF3F7] text-[#08193C] border border-[#D4E1EE]">
                      {patientData?.observations?.length || 0}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {patientData?.observations?.length ? (
                      patientData.observations.map((obs: any) => (
                        <div key={obs.id} className="p-2.5 rounded-xl bg-[#FDFEFE] border border-[#D4E1EE] text-xs flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-[#08193C]">{obs.name}</div>
                            <div className="text-[10px] text-[#465978]">Ref: {obs.referenceRange || "Normal"}</div>
                          </div>
                          <div className="font-mono font-bold text-[#08193C]">
                            {obs.value} {obs.unit}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#9AA5B4] py-3 text-center">No biomarkers recorded.</p>
                    )}
                  </div>
                </div>

                {/* Column 3: Active Medications */}
                <div className="p-5 rounded-2xl bg-white border border-[#D4E1EE] shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pill className="w-4 h-4 text-[#08193C]" />
                      <h3 className="text-sm font-bold text-[#08193C]">Active Medications</h3>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EDF3F7] text-[#08193C] border border-[#D4E1EE]">
                      {patientData?.medications?.length || 0}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {patientData?.medications?.length ? (
                      patientData.medications.map((m: any) => (
                        <div key={m.id} className="p-2.5 rounded-xl bg-[#FDFEFE] border border-[#D4E1EE] text-xs space-y-0.5">
                          <div className="font-semibold text-[#08193C]">{m.name} ({m.strength})</div>
                          <div className="text-[10px] text-[#465978]">{m.instructions}</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#9AA5B4] py-3 text-center">No active medications.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Connected Patients */}
        {activeTab === "patients" && (
          <div className="bg-white rounded-2xl border border-[#D4E1EE] p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-[#08193C]">Authorized Patient Connections</h3>
            {connections.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#9AA5B4]">
                No connected patients yet. Scan a patient's QR code to establish authorization.
              </div>
            ) : (
              <div className="divide-y divide-[#D4E1EE]">
                {connections.map((conn) => (
                  <div key={conn.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-[#08193C]">Patient ID: {conn.patientProfileId}</div>
                      <div className="text-xs text-[#465978]">
                        Connected: {new Date(conn.createdAt).toLocaleDateString()} • Status: {conn.status}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatient({ id: conn.patientProfileId, name: "Authorized Patient", ayuvSaathiId: "AS-P-CONNECTED" });
                        setActiveTab("overview");
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#EDF3F7] text-[#08193C] hover:bg-[#D4E1EE] cursor-pointer"
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
          <div className="bg-white rounded-2xl border border-[#D4E1EE] p-6 shadow-2xs space-y-5">
            <div className="border-b border-[#D4E1EE] pb-3">
              <h3 className="text-base font-bold text-[#08193C]">Create Clinical Prescription</h3>
              <p className="text-xs text-[#465978]">
                Prescriptions automatically propagate to the patient's active medications, reminders, and timeline.
              </p>
            </div>

            {!selectedPatient ? (
              <div className="p-6 rounded-xl bg-[#FFFDF5] border border-[#DDB549]/40 text-[#08193C] text-xs flex items-center justify-between">
                <span>Please scan or select an authorized patient before prescribing.</span>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#08193C] text-white font-bold text-xs"
                >
                  Scan QR
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreatePrescription} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#08193C] mb-1">
                      Patient
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`${selectedPatient.name} (${selectedPatient.ayuvSaathiId})`}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[#EDF3F7] border border-[#D4E1EE] font-semibold text-[#08193C]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#08193C] mb-1">
                      Clinical Diagnosis / Symptoms
                    </label>
                    <input
                      type="text"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="e.g. Acute Pharyngitis, Mild Hypertension"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4E1EE] focus:border-[#08193C] focus:ring-2 focus:ring-[#DDB549]/30 outline-hidden bg-[#FDFEFE] text-[#08193C]"
                    />
                  </div>
                </div>

                {/* Medicine Items */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#08193C] uppercase tracking-wide">
                      Prescribed Medicines ({prescItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={addPrescriptionItem}
                      className="flex items-center gap-1 text-xs text-[#08193C] hover:text-[#DDB549] font-bold cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Medicine</span>
                    </button>
                  </div>

                  {prescItems.map((item, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-[#EDF3F7] border border-[#D4E1EE] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#08193C]">Item #{idx + 1}</span>
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
                          className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded-lg border border-[#D4E1EE] bg-white text-[#08193C] focus:border-[#08193C]"
                        />
                        <input
                          type="text"
                          required
                          value={item.dosage}
                          onChange={(e) => updatePrescItem(idx, "dosage", e.target.value)}
                          placeholder="Dosage (e.g. 650 mg)"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-[#D4E1EE] bg-white text-[#08193C] focus:border-[#08193C]"
                        />
                        <input
                          type="text"
                          value={item.frequency}
                          onChange={(e) => updatePrescItem(idx, "frequency", e.target.value)}
                          placeholder="Frequency (e.g. TID)"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-[#D4E1EE] bg-white text-[#08193C] focus:border-[#08193C]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={item.duration}
                          onChange={(e) => updatePrescItem(idx, "duration", e.target.value)}
                          placeholder="Duration (e.g. 5 days)"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-[#D4E1EE] bg-white text-[#08193C] focus:border-[#08193C]"
                        />
                        <input
                          type="text"
                          value={item.instructions}
                          onChange={(e) => updatePrescItem(idx, "instructions", e.target.value)}
                          placeholder="Instructions (e.g. After food)"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-[#D4E1EE] bg-white text-[#08193C] focus:border-[#08193C]"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#08193C] mb-1">
                    Doctor's Clinical Advice & Follow-Up
                  </label>
                  <textarea
                    rows={2}
                    value={prescNotes}
                    onChange={(e) => setPrescNotes(e.target.value)}
                    placeholder="e.g. Drink plenty of warm fluids, return in 5 days if fever persists."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4E1EE] focus:border-[#08193C] focus:ring-2 focus:ring-[#DDB549]/30 outline-hidden bg-[#FDFEFE] text-[#08193C]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingPrescription}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#08193C] hover:bg-[#122958] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#DDB549]"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#DDB549]" />
                  <span>{savingPrescription ? "Synchronizing Prescription..." : "Issue & Synchronize Clinical Prescription"}</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* Tab 4: Patient Communications */}
        {activeTab === "comms" && (
          <div className="bg-white rounded-2xl border border-[#D4E1EE] p-6 shadow-2xs space-y-4">
            <h3 className="text-base font-bold text-[#08193C]">Direct Doctor-Patient Communication</h3>
            {!selectedPatient ? (
              <p className="text-xs text-[#465978]">Please select an active patient to exchange communications.</p>
            ) : (
              <div className="space-y-4">
                <div className="h-64 overflow-y-auto p-4 rounded-xl bg-[#EDF3F7] border border-[#D4E1EE] space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-10 text-xs text-[#9AA5B4]">
                      No communications yet with {selectedPatient.name}.
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl max-w-sm text-xs ${
                          m.senderRole === "doctor"
                            ? "ml-auto bg-[#08193C] text-white shadow-2xs"
                            : "mr-auto bg-white border border-[#D4E1EE] text-[#08193C]"
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
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#D4E1EE] focus:border-[#08193C] focus:ring-2 focus:ring-[#DDB549]/30 outline-hidden bg-[#FDFEFE] text-[#08193C]"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendMessage(false)}
                    disabled={sendingMsg || !messageText.trim()}
                    className="px-4 py-2 rounded-xl bg-[#08193C] hover:bg-[#122958] text-white text-xs font-bold cursor-pointer disabled:opacity-50 transition-colors focus-visible:outline-2 focus-visible:outline-[#DDB549]"
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
          <div className="bg-white rounded-2xl border border-red-200 p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-red-900">Doctor Emergency Communication Channel</h3>
                <p className="text-xs text-[#465978]">Urgent high-priority alert direct to patient device</p>
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
                <label className="block text-xs font-bold text-[#08193C]">
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
              <p className="text-xs text-[#465978]">Scan or select a patient to activate the emergency channel.</p>
            )}
          </div>
        )}

        {/* Tab 6: Doctor Profile */}
        {activeTab === "profile" && (
          <div className="bg-white rounded-2xl border border-[#D4E1EE] p-6 shadow-2xs space-y-4">
            <h3 className="text-base font-bold text-[#08193C]">Doctor Professional Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-[#EDF3F7] rounded-xl border border-[#D4E1EE]">
                <span className="text-[#465978] block">Full Name:</span>
                <span className="font-bold text-[#08193C]">{doctorUser?.displayName}</span>
              </div>
              <div className="p-3 bg-[#EDF3F7] rounded-xl border border-[#D4E1EE]">
                <span className="text-[#465978] block">Medical Registration No:</span>
                <span className="font-bold text-[#08193C]">{doc?.medicalRegistrationNumber || "MCI-48921-A"}</span>
              </div>
              <div className="p-3 bg-[#EDF3F7] rounded-xl border border-[#D4E1EE]">
                <span className="text-[#465978] block">Specialization:</span>
                <span className="font-bold text-[#08193C]">{doc?.specialization}</span>
              </div>
              <div className="p-3 bg-[#EDF3F7] rounded-xl border border-[#D4E1EE]">
                <span className="text-[#465978] block">Hospital / Clinic:</span>
                <span className="font-bold text-[#08193C]">{doc?.hospitalClinicName}</span>
              </div>
              <div className="p-3 bg-[#EDF3F7] rounded-xl border border-[#D4E1EE]">
                <span className="text-[#465978] block">Qualification:</span>
                <span className="font-bold text-[#08193C]">{doc?.qualification || "MBBS, MD"}</span>
              </div>
              <div className="p-3 bg-[#EDF3F7] rounded-xl border border-[#D4E1EE]">
                <span className="text-[#465978] block">Consultation Availability:</span>
                <span className="font-bold text-[#08193C]">{doc?.consultationAvailability || "Mon - Sat"}</span>
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
