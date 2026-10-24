"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { QRScannerModal } from "@/components/qr/QRScannerModal";
import { toast } from "sonner";
import {
  Pill,
  QrCode,
  Receipt,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Building,
  ShieldCheck,
  AlertCircle,
  IndianRupee,
  CreditCard,
  Printer,
  ArrowRight,
} from "lucide-react";

export default function PharmacistDashboardPage() {
  const currentLocale = useLocale();

  const [pharmUser, setPharmUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessiblePatients, setAccessiblePatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [activePrescriptions, setActivePrescriptions] = useState<any[]>([]);
  const [activeMeds, setActiveMeds] = useState<any[]>([]);
  const [previousBills, setPreviousBills] = useState<any[]>([]);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"billing" | "prescriptions" | "history" | "profile">("billing");

  // Billing state
  const [billItems, setBillItems] = useState([
    { medicineName: "Paracetamol 650mg", quantity: 10, unitPrice: 3.5, totalPrice: 35 },
  ]);
  const [discountPercent, setDiscountPercent] = useState(5);
  const [taxPercent, setTaxPercent] = useState(12);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState("");
  const [prescribingDoctorName, setPrescribingDoctorName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "pending">("paid");
  const [generatingBill, setGeneratingBill] = useState(false);
  const [lastGeneratedBill, setLastGeneratedBill] = useState<any>(null);

  const loadPharmData = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!res.ok || !data.user) {
        toast.error("Please sign in as a Pharmacist.");
        window.location.href = `/${currentLocale}/auth/professional?role=pharmacist`;
        return;
      }
      setPharmUser(data.user);

      // Fetch accessible patients directory
      setLoadingPatients(true);
      const patientsRes = await fetch("/api/professional/patients");
      const patientsData = await patientsRes.json();
      if (patientsData.ok) {
        setAccessiblePatients(patientsData.patients || []);
      }
    } catch {
      toast.error("Failed to load pharmacy workspace.");
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
        setActivePrescriptions(d.prescriptions || []);
        setActiveMeds(d.medications || []);
        setPreviousBills(d.bills || []);
        setActiveTab("billing");

        if (d.prescriptions && d.prescriptions.length > 0) {
          const latest = d.prescriptions[0];
          setSelectedPrescriptionId(latest.id);
          setPrescribingDoctorName(latest.doctorName);
          if (latest.items && latest.items.length > 0) {
            setBillItems(
              latest.items.map((i: any) => ({
                medicineName: `${i.medicineName} (${i.dosage})`,
                quantity: 10,
                unitPrice: 5.0,
                totalPrice: 50.0,
              }))
            );
          }
        }
        toast.success(`Selected patient ${d.patient.name} for pharmacy dispensing`);
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
    loadPharmData();
  }, []);

  const handlePatientResolved = (data: any) => {
    setSelectedPatient(data.patient);
    setActivePrescriptions(data.prescriptions || []);
    setActiveMeds(data.medications || []);
    setPreviousBills(data.previousBills || []);
    setActiveTab("billing");

    // If patient has an active doctor prescription, prefill the prescription reference
    if (data.prescriptions && data.prescriptions.length > 0) {
      const latest = data.prescriptions[0];
      setSelectedPrescriptionId(latest.id);
      setPrescribingDoctorName(latest.doctorName);

      // Auto populate bill items from the latest prescription
      if (latest.items && latest.items.length > 0) {
        setBillItems(
          latest.items.map((i: any) => ({
            medicineName: `${i.medicineName} (${i.dosage})`,
            quantity: 10,
            unitPrice: 15.0,
            totalPrice: 150.0,
          }))
        );
      }
    }
    toast.success(`Patient ${data.patient.name} connected. Medication profile loaded.`);
  };

  const addBillItem = () => {
    setBillItems([
      ...billItems,
      { medicineName: "", quantity: 1, unitPrice: 10.0, totalPrice: 10.0 },
    ]);
  };

  const removeBillItem = (index: number) => {
    if (billItems.length <= 1) return;
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const updateBillItem = (index: number, field: string, val: any) => {
    const updated = [...billItems];
    const current = { ...updated[index], [field]: val };
    if (field === "quantity" || field === "unitPrice") {
      const qty = Number(field === "quantity" ? val : current.quantity) || 0;
      const price = Number(field === "unitPrice" ? val : current.unitPrice) || 0;
      current.totalPrice = Number((qty * price).toFixed(2));
    }
    updated[index] = current;
    setBillItems(updated);
  };

  const subtotal = billItems.reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0);
  const discountAmount = Number(((subtotal * discountPercent) / 100).toFixed(2));
  const taxable = subtotal - discountAmount;
  const taxAmount = Number(((taxable * taxPercent) / 100).toFixed(2));
  const finalTotal = Number((taxable + taxAmount).toFixed(2));

  const handleGenerateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error("Please scan the patient's QR code first.");
      return;
    }

    const invalid = billItems.some((i) => !i.medicineName.trim() || i.quantity <= 0);
    if (invalid) {
      toast.error("Please ensure all items have valid names and quantities.");
      return;
    }

    setGeneratingBill(true);
    try {
      const res = await fetch("/api/pharmacy/bills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientProfileId: selectedPatient.id,
          items: billItems,
          subtotal,
          discount: discountAmount,
          tax: taxAmount,
          totalAmount: finalTotal,
          prescriptionId: selectedPrescriptionId || undefined,
          prescribingDoctorName: prescribingDoctorName || undefined,
          paymentStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create pharmacy bill.");
      } else {
        toast.success(`Medicine Bill #${data.bill.id} generated & recorded!`);
        setLastGeneratedBill(data.bill);
        setPreviousBills([data.bill, ...previousBills]);
      }
    } catch {
      toast.error("Network error creating pharmacy bill.");
    } finally {
      setGeneratingBill(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="py-20 text-center text-slate-500 text-sm">
          Loading authorized Pharmacy Workspace...
        </div>
      </AppShell>
    );
  }

  const pharm = pharmUser?.pharmacistProfile;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto w-full py-6 px-4 sm:px-6 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-950 via-amber-900 to-orange-950 text-white shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-amber-200 border border-white/20">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{pharmUser?.displayName || "Priya Sharma, B.Pharm"}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Licensed Pharmacist
                </span>
              </div>
              <p className="text-xs text-amber-200 mt-0.5">
                {pharm?.pharmacyName || "MedPlus Pharmacy & Wellness"} • {pharm?.licenseNumber || "TS-PHARM-2024-8841"}
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
        {selectedPatient ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-700 text-white flex items-center justify-center font-bold text-sm">
                {selectedPatient.name.slice(0, 1)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#17344F]">{selectedPatient.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                    {selectedPatient.ayuvSaathiId}
                  </span>
                  {selectedPatient.relationship !== "self" && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-semibold uppercase">
                      {selectedPatient.relationship}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Permitted Medication View • Patient Privacy Protected (Full diagnostic notes restricted)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
              >
                <span>Patient Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSelectedPatient(null);
                  setLastGeneratedBill(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-semibold cursor-pointer"
              >
                Switch Patient
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span>Scan patient QR or select an authorized patient profile below to view active prescriptions and dispense medication.</span>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs cursor-pointer shrink-0"
              >
                Scan Patient QR
              </button>
            </div>

            {/* Accessible Patient Directory */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Authorized Patient Directory</h4>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  {accessiblePatients.length} Registered
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {accessiblePatients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectPatientById(p.id)}
                    className="p-3 text-left rounded-lg border border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/50 transition-colors cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-slate-800 group-hover:text-amber-900">{p.name}</div>
                    <div className="text-[10px] font-mono text-amber-700">{p.ayuvSaathiId}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Prescriptions: {p.prescriptionsCount || 0}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          {[
            { id: "billing", label: "Medicine Billing & Dispense", icon: Receipt },
            { id: "prescriptions", label: `Doctor Prescriptions (${activePrescriptions.length})`, icon: FileText },
            { id: "history", label: `Past Bills (${previousBills.length})`, icon: Clock },
            { id: "profile", label: "Pharmacy Profile", icon: Building },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active ? "bg-[#17344F] text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Billing & Dispensing */}
        {activeTab === "billing" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#17344F]">Pharmacy Billing & Medication Dispensing</h3>
                <p className="text-xs text-slate-600">
                  Generates an itemized pharmacy invoice and logs the dispense record on the patient's health timeline.
                </p>
              </div>
              <div className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                Purchase Record ≠ Clinical Prescription
              </div>
            </div>

            {!selectedPatient ? (
              <p className="text-xs text-slate-500 py-4">Please scan patient QR before generating a bill.</p>
            ) : (
              <form onSubmit={handleGenerateBill} className="space-y-4">
                {/* Doctor Prescription Reference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Doctor Prescription Reference (Optional)
                    </label>
                    <input
                      type="text"
                      value={selectedPrescriptionId}
                      onChange={(e) => setSelectedPrescriptionId(e.target.value)}
                      placeholder="e.g. Rx ID from doctor"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Prescribing Doctor Name
                    </label>
                    <input
                      type="text"
                      value={prescribingDoctorName}
                      onChange={(e) => setPrescribingDoctorName(e.target.value)}
                      placeholder="e.g. Dr. K. Srinivas Rao"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                {/* Itemized Medicine Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Medicine Line Items
                    </span>
                    <button
                      type="button"
                      onClick={addBillItem}
                      className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Medicine</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {billItems.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-2">
                        <input
                          type="text"
                          required
                          value={item.medicineName}
                          onChange={(e) => updateBillItem(idx, "medicineName", e.target.value)}
                          placeholder="Medicine name & dosage"
                          className="flex-2 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                        />
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-500">Qty:</span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateBillItem(idx, "quantity", e.target.value)}
                              className="w-16 px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-center"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-500">Price:</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => updateBillItem(idx, "unitPrice", e.target.value)}
                              className="w-20 px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-center"
                            />
                          </div>
                          <div className="w-20 text-right font-bold text-xs text-slate-800">
                            ₹{item.totalPrice}
                          </div>
                          {billItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBillItem(idx)}
                              className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calculation Summary Box */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 max-w-sm ml-auto space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Discount ({discountPercent}%):</span>
                    <span className="text-emerald-700 font-semibold">- ₹{discountAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>GST Tax ({taxPercent}%):</span>
                    <span className="font-semibold">+ ₹{taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                    <span>Final Amount:</span>
                    <span className="text-amber-800 font-mono text-base">₹{finalTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={generatingBill}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{generatingBill ? "Generating Pharmacy Invoice..." : `Dispense & Record Bill (₹${finalTotal.toFixed(2)})`}</span>
                </button>
              </form>
            )}

            {lastGeneratedBill && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Pharmacy Bill #{lastGeneratedBill.id} Created!</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-800">₹{lastGeneratedBill.totalAmount}</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Dispense record logged to patient's health timeline. A notification has been delivered to the patient.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Doctor Prescriptions */}
        {activeTab === "prescriptions" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-[#17344F]">Authorized Prescriptions for Dispensing</h3>
            {activePrescriptions.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No active doctor prescriptions on file for this patient.</p>
            ) : (
              <div className="space-y-3">
                {activePrescriptions.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-800">
                        Prescription by {p.doctorName} ({p.clinicHospitalName})
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {p.prescriptionDate ? new Date(p.prescriptionDate).toLocaleDateString() : "Recent"}
                      </span>
                    </div>
                    {p.diagnosis && <div className="text-slate-600">Diagnosis: {p.diagnosis}</div>}
                    <div className="divide-y divide-slate-200 pt-1">
                      {p.items?.map((item: any, i: number) => (
                        <div key={i} className="py-1 flex justify-between">
                          <span className="font-semibold text-slate-700">{item.medicineName} ({item.dosage})</span>
                          <span className="text-slate-500">{item.frequency} • {item.duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: History */}
        {activeTab === "history" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-[#17344F]">Previous Dispensed Bills</h3>
            {previousBills.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No bills recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {previousBills.map((b) => (
                  <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">Bill #{b.id} • {b.pharmacyName}</div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(b.billDate).toLocaleDateString()} • {b.items?.length || 1} items • Status: {b.paymentStatus}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-amber-800 text-sm">
                      ₹{b.totalAmount}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Profile */}
        {activeTab === "profile" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-[#17344F]">Pharmacy Store & Pharmacist Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Pharmacist Name:</span>
                <span className="font-bold text-slate-800">{pharmUser?.displayName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Pharmacist License No:</span>
                <span className="font-bold text-slate-800">{pharm?.licenseNumber || "TS-PHARM-8821"}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Pharmacy Name:</span>
                <span className="font-bold text-slate-800">{pharm?.pharmacyName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Pharmacy Store Address:</span>
                <span className="font-bold text-slate-800">{pharm?.pharmacyAddress || "Hitech City, Hyderabad"}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Contact Phone:</span>
                <span className="font-bold text-slate-800">{pharm?.contactNumber || "+91 98765 88990"}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Designation:</span>
                <span className="font-bold text-slate-800">{pharm?.designation || "Chief Dispensing Pharmacist"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Universal QR Scanner Modal */}
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onResolved={handlePatientResolved}
          portalRole="pharmacist"
        />
      </div>
    </AppShell>
  );
}
