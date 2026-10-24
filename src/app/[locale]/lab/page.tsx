"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { QRScannerModal } from "@/components/qr/QRScannerModal";
import { toast } from "sonner";
import {
  FlaskConical,
  QrCode,
  Upload,
  FileText,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Building,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  FileCheck,
} from "lucide-react";

export default function LabTechnicianDashboardPage() {
  const currentLocale = useLocale();

  const [labUser, setLabUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [recentReports, setRecentReports] = useState<any[]>([]);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"upload" | "reports" | "profile">("upload");

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);

  const loadLabData = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!res.ok || !data.user) {
        toast.error("Please sign in as a Lab Technician.");
        window.location.href = `/${currentLocale}/auth/professional?role=lab_tech`;
        return;
      }
      setLabUser(data.user);
    } catch {
      toast.error("Failed to load lab workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLabData();
  }, []);

  const handlePatientResolved = (data: any) => {
    setSelectedPatient(data.patient);
    if (data.recentReports) {
      setRecentReports(data.recentReports);
    }
    setActiveTab("upload");
    toast.success(`Patient ${data.patient.name} linked to diagnostic session.`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error("Please scan the patient's QR code first.");
      return;
    }
    if (!selectedFile) {
      toast.error("Please select a diagnostic report PDF or image.");
      return;
    }

    setUploading(true);
    setUploadProgress("Uploading file & extracting biomarkers via AI pipeline...");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("category", "lab_report");
      formData.append("ownerId", selectedPatient.id); // Associated with scanned patient profile

      // Upload using existing AyuvSaathi document processing route
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to upload laboratory report.");
      } else {
        toast.success(`Diagnostic report attached to ${selectedPatient.name}'s profile!`);
        setUploadResult(data);
        setRecentReports([data.document, ...recentReports]);
        setSelectedFile(null);
      }
    } catch {
      toast.error("Network error during report upload.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="py-20 text-center text-slate-500 text-sm">
          Loading authorized Laboratory Workspace...
        </div>
      </AppShell>
    );
  }

  const lab = labUser?.labTechProfile;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto w-full py-6 px-4 sm:px-6 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 text-white shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-purple-200 border border-white/20">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{labUser?.displayName || "Rajesh Varma, MLT"}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  NABL Verified
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-0.5">
                {lab?.labName || "Aster Diagnostic Centre"} • {lab?.designation || "Lead Diagnostic Technologist"}
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-950">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-700 text-white flex items-center justify-center font-bold text-sm">
                {selectedPatient.name.slice(0, 1)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#17344F]">{selectedPatient.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">
                    {selectedPatient.ayuvSaathiId}
                  </span>
                  {selectedPatient.relationship !== "self" && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold uppercase">
                      {selectedPatient.relationship}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Secure Patient ID resolved • Uploaded reports automatically associate with this profile
                </p>
              </div>
            </div>

            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Patient Identity Confirmed
            </span>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
            <span>Please scan the patient's QR code to link diagnostic uploads to their profile.</span>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs cursor-pointer"
            >
              Scan Patient QR
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          {[
            { id: "upload", label: "Upload Diagnostic Report", icon: Upload },
            { id: "reports", label: `Sent Reports (${recentReports.length})`, icon: FileText },
            { id: "profile", label: "Laboratory Profile", icon: Building },
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

        {/* Tab 1: Upload Diagnostic Report */}
        {activeTab === "upload" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#17344F]">Attach Laboratory Report</h3>
              <p className="text-xs text-slate-600">
                Uploaded reports trigger OCR, biomarker extraction, patient notifications, and timeline synchronization.
              </p>
            </div>

            <form onSubmit={handleUploadReport} className="space-y-4">
              <div className="p-6 border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-3 hover:border-purple-500 transition-colors bg-slate-50/50">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <label className="text-xs font-bold text-purple-700 hover:underline cursor-pointer">
                    <span>Click to select PDF or image file</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1">Supported: PDF, PNG, JPG (up to 15MB)</p>
                </div>
                {selectedFile && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-100 text-purple-900 text-xs font-semibold">
                    <FileCheck className="w-4 h-4" />
                    <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>

              {uploadProgress && (
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center gap-2">
                  <Clock className="w-4 h-4 animate-spin text-purple-600" />
                  <span>{uploadProgress}</span>
                </div>
              )}

              {uploadResult && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Report processed and attached to {selectedPatient?.name} successfully!</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    The report has been analyzed with the AyuvSaathi biomarker extractor. Patient notification sent.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || !selectedFile || !selectedPatient}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{uploading ? "Analyzing & Attaching..." : "Upload & Analyze Report"}</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Sent Reports */}
        {activeTab === "reports" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-[#17344F]">Diagnostic Reports in Session</h3>
            {recentReports.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No reports attached in this session yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentReports.map((r) => (
                  <div key={r.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{r.displayName}</div>
                      <div className="text-[11px] text-slate-500">
                        Status: {r.processingStatus} • {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "Just now"}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                      Attached
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Lab Profile */}
        {activeTab === "profile" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-[#17344F]">Laboratory & Technician Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Technician Name:</span>
                <span className="font-bold text-slate-800">{labUser?.displayName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Technician ID:</span>
                <span className="font-bold text-slate-800">{lab?.technicianId || "TECH-8821"}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Laboratory Name:</span>
                <span className="font-bold text-slate-800">{lab?.labName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Accreditation Details:</span>
                <span className="font-bold text-slate-800">{lab?.labRegistration || "NABL ISO-15189"}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Laboratory Address:</span>
                <span className="font-bold text-slate-800">{lab?.labAddress || "Hyderabad"}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block">Designation:</span>
                <span className="font-bold text-slate-800">{lab?.designation || "Lead Technologist"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Universal QR Scanner Modal */}
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onResolved={handlePatientResolved}
          portalRole="lab_tech"
        />
      </div>
    </AppShell>
  );
}
