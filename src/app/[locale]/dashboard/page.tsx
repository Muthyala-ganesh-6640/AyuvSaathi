"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { UniversalPatientQR } from "@/components/qr/UniversalPatientQR";
import type { WellnessProfileAnalysis, WellnessRecommendation } from "@/lib/medical/wellness";
import { FamilyProfileSwitcher } from "@/components/family/FamilyProfileSwitcher";
import { NotificationsDrawer } from "@/components/notifications/NotificationsDrawer";
import {
  Search,
  Bell,
  Globe,
  ChevronDown,
  LayoutDashboard,
  FileText,
  ClipboardList,
  FolderHeart,
  Bot,
  FileCheck2,
  Pill,
  BarChart3,
  MapPin,
  Settings,
  HeartPulse,
  Activity,
  User,
  LogOut,
  Upload,
  ArrowRight,
  ShieldCheck,
  Check,
  Clock,
  Sparkles,
  ChevronRight,
  Zap,
  Building2,
  Stethoscope,
  Receipt,
  AlertTriangle,
  QrCode,
  MessageSquare,
  Phone,
  Menu,
  X,
} from "lucide-react";
import { useCallback, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatDate } from "@/lib/utils";

interface DashboardData {
  user: {
    displayName: string;
    email: string;
    interfaceLanguage: string;
    timezone: string;
  };
  today: string;
  medicines: {
    id: string;
    medicationId: string;
    medicationName: string;
    scheduledTime: string;
    status: "pending" | "taken" | "skipped" | "missed";
    synthetic?: boolean;
    strength?: string;
    instructions?: string;
  }[];
  documents: {
    id: string;
    displayName: string;
    category: string;
    processingStatus: string;
    sourceDate?: string;
    createdAt: string;
  }[];
  recentLabReports?: {
    id: string;
    displayName: string;
    category: string;
    processingStatus: string;
    sourceDate?: string;
    createdAt: string;
  }[];
  recentDischargeSummaries?: {
    id: string;
    displayName: string;
    category: string;
    processingStatus: string;
    createdAt: string;
  }[];
  recentDoctorVisitDocs?: {
    id: string;
    displayName: string;
    category: string;
    processingStatus: string;
    createdAt: string;
  }[];
  recentPrescriptionDocs?: {
    id: string;
    displayName: string;
    category: string;
    processingStatus: string;
    createdAt: string;
  }[];
  recentMedications: {
    id: string;
    name: string;
    strength: string;
    instructions: string;
    status: string;
    provenance: string;
  }[];
  timeline: {
    id: string;
    type: string;
    summary: string;
    eventDate: string;
    provenance: string;
    relatedId?: string;
  }[];
  visits?: {
    id: string;
    title: string;
    content: string;
    createdAt: string;
  }[];
  upcomingAppointments: {
    id: string;
    title: string;
    facility?: string;
    startsAt: string;
  }[];
  observationCount: number;
  glucoseObservations?: {
    id: string;
    name: string;
    value: string;
    unit: string;
    referenceRange?: string;
    sourceDate?: string;
    createdAt: string;
  }[];
  stats?: {
    labReportsCount: number;
    remindersCount: number;
    treatmentPlansCount: number;
    medicalRecordsCount: number;
  };
  activeProfile?: {
    id: string;
    name: string;
    ayuvSaathiId: string;
    relationship: string;
  };
  familyMembers?: {
    id: string;
    name: string;
    relationship: string;
    ayuvSaathiId: string;
    bloodGroup?: string;
    emergencyContact?: string;
  }[];
  connections?: {
    id: string;
    patientProfileId: string;
    professionalId: string;
    professionalRole: string;
    professionalName: string;
    specialization?: string;
    organizationName: string;
    department?: string;
    contactNumber?: string;
    status: string;
    lastInteractionAt: string;
  }[];
  pharmacyBills?: {
    id: string;
    billDate: string;
    pharmacyName: string;
    pharmacistName: string;
    totalAmount: number;
    paymentStatus: string;
    items: {
      medicineName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }[];
  }[];
  prescriptions?: {
    id: string;
    doctorName: string;
    clinicHospitalName: string;
    prescriptionDate: string;
    diagnosis?: string;
    items: {
      medicineName: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions: string;
    }[];
  }[];
  notifications?: {
    id: string;
    title: string;
    message: string;
    type: string;
    link?: string;
    read: boolean;
    createdAt: string;
  }[];
  unreadNotificationsCount?: number;
  wellnessAnalysis?: WellnessProfileAnalysis;
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const common = useTranslations("common");
  const nav = useTranslations("nav");
  const header = useTranslations("header");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<"3" | "6" | "12">("3");
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [selectedDoctorForEmergency, setSelectedDoctorForEmergency] = useState<any>(null);
  const [selectedWellnessCategory, setSelectedWellnessCategory] = useState<"all" | "diet" | "activity" | "sleep" | "habits">("all");


  const [emergencyText, setEmergencyText] = useState("");
  const [sendingEmergency, setSendingEmergency] = useState(false);

  // Compute Greeting strictly based on Indian Standard Time (IST, UTC+5:30)
  const getIstGreeting = () => {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    const istDate = new Date(utcTime + 5.5 * 3600000);
    const hour = istDate.getHours();

    if (hour >= 4 && hour < 12) {
      return t("goodMorning");
    } else if (hour >= 12 && hour < 17) {
      return t("goodAfternoon");
    } else {
      return t("goodEvening");
    }
  };

  const fetchDashboard = useCallback(async (profileId?: string) => {
    try {
      const targetId = profileId !== undefined ? profileId : activeProfileId;
      const url = targetId ? `/api/dashboard?patientProfileId=${encodeURIComponent(targetId)}` : "/api/dashboard";
      const res = await fetch(url);
      if (res.status === 401) {
        router.push("/auth/sign-in");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        // Server-verified authoritative role guard: redirect professionals to their dedicated workspace
        if (json.user?.role && json.user.role === "doctor") {
          window.location.href = `/${locale}/doctor`;
          return;
        }
        setData(json);
        if (json.activeProfile && !activeProfileId) {
          setActiveProfileId(json.activeProfile.id);
        }
      }
    } catch {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [router, activeProfileId]);

  const handleConfirmDose = async (doseId: string) => {
    try {
      const res = await fetch(`/api/doses/${doseId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "taken" }),
      });
      if (res.ok) {
        toast.success("Dose confirmed as taken!");
        fetchDashboard(activeProfileId);
      } else {
        toast.error("Could not update dose");
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
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message || `Dose snoozed by ${snoozeMinutes} mins`);
        fetchDashboard(activeProfileId);
      } else {
        toast.error("Could not snooze dose");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleProfileSwitch = (newProfileId: string) => {
    setActiveProfileId(newProfileId);
    setLoading(true);
    fetchDashboard(newProfileId);
  };

  const handleSendEmergencyToDoctor = async () => {
    if (!selectedDoctorForEmergency || !emergencyText.trim()) return;
    setSendingEmergency(true);
    try {
      const res = await fetch("/api/professional/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientProfileId: activeProfileId || data?.activeProfile?.id,
          professionalId: selectedDoctorForEmergency.professionalId,
          message: emergencyText.trim(),
          isEmergency: true,
        }),
      });
      const resJson = await res.json();
      if (resJson.ok) {
        toast.success("Doctor emergency alert sent to " + selectedDoctorForEmergency.professionalName);
        setEmergencyText("");
        setEmergencyModalOpen(false);
      } else {
        toast.error(resJson.error || "Failed to send emergency alert.");
      }
    } catch {
      toast.error("Network error sending alert.");
    } finally {
      setSendingEmergency(false);
    }
  };

  const handleSwitchDomain = async (targetRole: "patient" | "doctor") => {
    try {
      const res = await fetch("/api/auth/switch-role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetRole }),
      });
      const d = await res.json();
      if (res.ok && d.redirectUrl) {
        toast.success(`Switching domain to ${targetRole}...`);
        window.location.href = d.redirectUrl;
      } else {
        toast.error(d.error || `Please register your ${targetRole} profile to access this portal.`);
        router.push("/auth/professional?role=doctor&mode=register");
      }
    } catch {
      toast.error("Error switching domain");
    }
  };

  const handleRevokeConnection = async (connId: string) => {
    try {
      const res = await fetch("/api/connections", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: connId, status: "revoked" }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success("Doctor collaboration access revoked");
        fetchDashboard(activeProfileId);
      } else {
        toast.error(d.error || "Failed to revoke access");
      }
    } catch {
      toast.error("Network error revoking access");
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
      toast.success("Signed out successfully");
      router.push("/auth/sign-in");
    } catch {
      toast.error("Sign out failed");
    }
  };

  const handleLanguageChange = (newLocale: "en" | "te" | "hi") => {
    setLangDropdownOpen(false);
    router.replace(pathname, { locale: newLocale });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/reports?search=${encodeURIComponent(searchQuery)}`);
  };

  const handlePromptClick = (promptText: string) => {
    router.push(`/assistant?q=${encodeURIComponent(promptText)}`);
  };

  // Nav menu items including dedicated Discharge Summary section
  const navItems = [
    { href: "/dashboard", label: nav("dashboard"), icon: LayoutDashboard, active: true },
    { href: "/reports", label: nav("reports"), icon: FileText },
    { href: "/discharge-summary", label: nav("dischargeSummary"), icon: Building2 },
    { href: "/doctor-summary", label: nav("doctorSummary"), icon: ClipboardList },
    { href: "/timeline", label: nav("timeline"), icon: FolderHeart },
    { href: "/assistant", label: nav("assistant"), icon: Bot },
    { href: "/prescriptions", label: nav("prescriptions"), icon: FileCheck2 },
    { href: "/reminders", label: nav("reminders"), icon: Pill, badge: data?.stats?.remindersCount ?? 0 },
    { href: "/analytics", label: nav("analytics"), icon: BarChart3 },
    { href: "/find-care", label: nav("findCare"), icon: MapPin },
    { href: "/settings", label: nav("settings"), icon: Settings },
  ];

  // Show only reminders based on the user's actual scheduled doses.
  const dynamicReminders =
    data?.medicines && data.medicines.length > 0
      ? data.medicines.slice(0, 4).map((med, idx) => {
          const isTaken = med.status === "taken";
          const isPending = med.status === "pending";
          return {
            id: med.id,
            name: med.medicationName,
            instruction: `${med.scheduledTime} · ${med.strength ? med.strength + " · " : ""}Scheduled Dose`,
            status: isTaken ? t("taken") : isPending ? t("upcoming") : med.status.toUpperCase(),
            isPending,
            badgeColor: isTaken ? "bg-[#E8F5E9] text-[#2E7D32]" : "bg-[#EDF3F7] text-[#08193C]",
            iconBg: idx === 0 ? "bg-[#EDF3F7] text-[#08193C]" : idx === 1 ? "bg-[#EDF3F7] text-[#DDB549]" : "bg-[#EDF3F7] text-[#465978]",
          };
        })
      : [];

  const allWellnessRecs = data?.wellnessAnalysis?.recommendations || [];
  const filteredWellnessRecs =
    selectedWellnessCategory === "all"
      ? allWellnessRecs
      : allWellnessRecs.filter((r) => r.category === selectedWellnessCategory);

  // Dynamic Recent Activity mapped strictly from genuine chronological events
  const dynamicActivities =
    data?.timeline && data.timeline.length > 0
      ? data.timeline.slice(0, 5).map((ev) => {
          let color = "bg-[#3186F6]";
          let title = t("actLabUploaded");
          if (ev.type === "prescription") {
            color = "bg-[#8B5CE8]";
            title = t("actPrescriptionAnalyzed");
          } else if (ev.type === "medication" || ev.type === "dose") {
            color = "bg-[#F59A35]";
            title = t("actMedicineReminder");
          } else if (ev.type === "visit" || ev.type === "consultation") {
            color = "bg-[#28AD65]";
            title = t("actTreatmentUpdated");
          } else if (ev.type === "discharge") {
            color = "bg-[#8B5CE8]";
            title = t("actRecordAdded");
          }

          return {
            id: ev.id,
            title,
            desc: ev.summary,
            time: formatDate(ev.eventDate, locale),
            color,
          };
        })
      : [];

  // Dynamic Recent Lab Reports mapped from user's genuine lab reports only
  const dynamicLabReports =
    data?.recentLabReports && data.recentLabReports.length > 0
      ? data.recentLabReports.slice(0, 3).map((r) => ({
          id: r.id,
          name: r.displayName,
          date: formatDate(r.sourceDate || r.createdAt, locale),
          source: "Medical Record",
          status: r.processingStatus === "extracted" ? "Processed" : r.processingStatus,
        }))
      : [];

  // Dynamic Recent Medical Records with direct dedicated routing
  const dynamicMedicalRecords = [
    ...(data?.recentDoctorVisitDocs ?? []).map((document) => ({
      key: `doctor-visit-${document.id}`,
      title: document.displayName,
      date: `${formatDate(document.createdAt, locale)} · ${t("actTreatmentUpdated")}`,
      href: "/doctor-summary",
    })),
    ...(data?.recentPrescriptionDocs ?? []).map((document) => ({
      key: `prescription-${document.id}`,
      title: document.displayName,
      date: formatDate(document.createdAt, locale),
      href: "/prescriptions",
    })),
    ...(data?.recentDischargeSummaries ?? []).map((document) => ({
      key: `discharge-summary-${document.id}`,
      title: document.displayName,
      date: formatDate(document.createdAt, locale),
      href: "/discharge-summary",
    })),
    ...(data?.recentLabReports ?? []).map((document) => ({
      key: `lab-report-${document.id}`,
      title: document.displayName,
      date: formatDate(document.sourceDate || document.createdAt, locale),
      href: `/reports/${document.id}`,
    })),
  ].slice(0, 4);

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - Number(dateRange));
  const chartData = (data?.glucoseObservations ?? [])
    .flatMap((observation) => {
      const value = Number.parseFloat(observation.value);
      const sourceDate = observation.sourceDate || observation.createdAt;
      const timestamp = Date.parse(sourceDate);
      if (!Number.isFinite(value) || !Number.isFinite(timestamp) || timestamp < cutoff.getTime()) {
        return [];
      }
      return [{ date: formatDate(sourceDate, locale), value, timestamp }];
    })
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(({ date, value }) => ({ date, value }));

  const latestGlucose = chartData[chartData.length - 1];
  const displayName = data?.user?.displayName || t("patientRole");
  const reminderCount = data?.stats?.remindersCount ?? 0;

  return (
    <div className="min-h-screen bg-[#FDFEFE] text-[#08193C] font-sans flex flex-col antialiased selection:bg-[#EDF3F7] selection:text-[#08193C]">
      {/* Top Application Header: 72px high */}
      <header className="h-[72px] bg-white border-b border-[#D4E1EE] px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        {/* Left: Menu button + Brand block */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D4E1EE] hover:bg-[#EDF3F7] text-[#08193C] font-bold text-xs transition-colors cursor-pointer shadow-2xs focus-visible:outline-2 focus-visible:outline-[#DDB549]"
            title={isMenuOpen ? "Close Menu" : "Open Menu"}
          >
            {isMenuOpen ? <X className="w-4 h-4 text-[#DDB549]" /> : <Menu className="w-4 h-4 text-[#08193C]" />}
            <span className="text-xs font-bold">{isMenuOpen ? "Close" : "Menu"}</span>
          </button>
          <BrandLogo variant="header" href="/dashboard" />
        </div>

        {/* Center: Search input & Family Switcher */}
        <div className="flex-1 max-w-[640px] mx-4 flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 text-[#465978] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={header("searchPlaceholder")}
              className="w-full bg-[#EDF3F7] border border-[#D4E1EE] focus:border-[#08193C] focus:bg-white focus:ring-2 focus:ring-[#DDB549]/30 text-xs sm:text-sm text-[#08193C] rounded-xl pl-9 pr-16 py-2 outline-hidden transition-all placeholder:text-[#9AA5B4]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#465978] border border-[#D4E1EE] bg-white px-1.5 py-0.5 rounded font-medium">
              Ctrl + K
            </span>
          </form>

          {data?.user && (
            <FamilyProfileSwitcher
              primaryUser={{
                id: (data.user as any).id || "primary",
                displayName: data.user.displayName || "You",
                ayuvSaathiId: data.activeProfile?.ayuvSaathiId,
              }}
              familyMembers={data.familyMembers || []}
              activeProfileId={activeProfileId || data.activeProfile?.id || (data.user as any).id || ""}
              onSelectProfile={handleProfileSwitch}
              onFamilyMemberAdded={() => fetchDashboard(activeProfileId)}
            />
          )}
        </div>

        {/* Right Section: Notifications, Language, Profile */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Notifications Drawer */}
          <NotificationsDrawer
            notifications={data?.notifications || []}
            unreadCount={data?.unreadNotificationsCount ?? 0}
            onRefresh={() => fetchDashboard(activeProfileId)}
          />

          {/* Language Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#D4E1EE] rounded-xl text-xs font-semibold text-[#08193C] hover:bg-[#EDF3F7] transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-[#DDB549]" />
              <span>{locale === "te" ? "తెలుగు" : locale === "hi" ? "हिन्दी" : "English"}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#465978]" />
            </button>

            {langDropdownOpen && (
              <div className="absolute right-0 mt-1 w-32 bg-white border border-[#D4E1EE] rounded-xl shadow-lg py-1 z-40 text-xs">
                <button
                  type="button"
                  onClick={() => handleLanguageChange("en")}
                  className={`w-full text-left px-3 py-2 hover:bg-[#EDF3F7] flex items-center justify-between ${
                    locale === "en" ? "font-bold text-[#08193C] bg-[#EDF3F7]/60" : "text-[#465978]"
                  }`}
                >
                  English {locale === "en" && <Check className="w-3.5 h-3.5 text-[#DDB549]" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("te")}
                  className={`w-full text-left px-3 py-2 hover:bg-[#EDF3F7] flex items-center justify-between ${
                    locale === "te" ? "font-bold text-[#08193C] bg-[#EDF3F7]/60" : "text-[#465978]"
                  }`}
                >
                  తెలుగు {locale === "te" && <Check className="w-3.5 h-3.5 text-[#DDB549]" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("hi")}
                  className={`w-full text-left px-3 py-2 hover:bg-[#EDF3F7] flex items-center justify-between ${
                    locale === "hi" ? "font-bold text-[#08193C] bg-[#EDF3F7]/60" : "text-[#465978]"
                  }`}
                >
                  हिन्दी {locale === "hi" && <Check className="w-3.5 h-3.5 text-[#DDB549]" />}
                </button>
              </div>
            )}
          </div>

          {/* User Profile Avatar with Online Badge */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-[#EDF3F7] transition-colors cursor-pointer"
            >
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-[#08193C] text-white flex items-center justify-center text-xs font-bold ring-2 ring-[#DDB549]/30">
                  {displayName.charAt(0)}
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-[#28AD65] ring-2 ring-white absolute -bottom-0.5 -right-0.5" />
              </div>
              <div className="hidden lg:block text-left pr-1">
                <p className="text-xs font-bold text-[#08193C] leading-tight">{displayName}</p>
                <p className="text-[10px] text-[#465978] leading-tight">Patient</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#465978] hidden lg:block" />
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-[#D4E1EE] rounded-xl shadow-lg py-1 z-40 text-xs">
                <div className="px-3 py-2 border-b border-[#D4E1EE]">
                  <p className="font-bold text-[#08193C]">{displayName}</p>
                  <p className="text-[10px] text-[#9AA5B4] truncate">{data?.user?.email || "patient@ayuvsaathi.in"}</p>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="w-full text-left px-3 py-2 hover:bg-[#EDF3F7] flex items-center gap-2 text-[#465978] hover:text-[#08193C]"
                >
                  <User className="w-3.5 h-3.5 text-[#08193C]" />
                  Profile Settings
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-[#D4E1EE]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container: Collapsible Menu Drawer + Dashboard Content */}
      <div className="flex-1 flex w-full relative justify-center">
        {/* Collapsible Menu Drawer: Hidden by default, shown when Menu button is pressed */}
        {isMenuOpen && (
          <>
            <div
              className="fixed inset-0 top-[72px] bg-[#08193C]/40 backdrop-blur-2xs z-30 transition-opacity"
              onClick={() => setIsMenuOpen(false)}
            />
            <aside className="fixed top-[72px] left-0 bottom-0 z-40 w-[280px] bg-white border-r border-[#D4E1EE] flex flex-col justify-between py-5 px-3 shadow-2xl animate-in slide-in-from-left duration-200 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-3 pb-2 border-b border-[#D4E1EE]">
                  <span className="text-xs font-bold text-[#465978] uppercase tracking-wider">Navigation Menu</span>
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen(false)}
                    className="p-1 rounded-lg hover:bg-[#EDF3F7] text-[#08193C] cursor-pointer"
                  >
                    <X className="w-4 h-4 text-[#08193C]" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMenuOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                          item.active
                            ? "bg-[#EDF3F7] text-[#08193C] border-l-4 border-[#DDB549]"
                            : "text-[#465978] hover:bg-[#EDF3F7] hover:text-[#08193C]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            className={`w-4 h-4 transition-colors ${
                              item.active ? "text-[#DDB549]" : "text-[#465978] group-hover:text-[#08193C]"
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>
                        {item.badge !== undefined && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              item.active ? "bg-[#08193C] text-white" : "bg-[#EDF3F7] text-[#465978]"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>

                {/* Connected Healthcare Portals in Menu */}
                <div className="pt-3 border-t border-[#D4E1EE]">
                  <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#465978] mb-2">
                    Care Team Dashboards
                  </p>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleSwitchDomain("doctor");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-[#08193C] hover:bg-[#EDF3F7] transition-colors text-left cursor-pointer"
                    >
                      <Stethoscope className="w-4 h-4 text-[#DDB549]" />
                      <span>Doctor Workspace</span>
                    </button>

                  </div>
                </div>
              </div>

              {/* Patient Identity QR card in menu */}
              <div className="mt-6 pt-4 border-t border-[#D4E1EE]">
                {data?.user && (
                  <UniversalPatientQR
                    patientProfileId={activeProfileId || data.activeProfile?.id || (data.user as any).id || ""}
                    patientName={displayName}
                    ayuvSaathiId={data.activeProfile?.ayuvSaathiId || "AYUV-LIVE"}
                  />
                )}
              </div>
            </aside>
          </>
        )}

        {/* Dashboard Canvas: Full-width when menu is closed, perfectly centered */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7 overflow-x-hidden w-full flex flex-col items-center">
          <div className="w-full max-w-7xl mx-auto space-y-6">
          {/* Healthcare Ecosystem Connected Network Hub */}
          <div className="mb-6 bg-gradient-to-r from-[#08193C] via-[#0C2353] to-[#08193C] rounded-2xl p-4 sm:p-5 text-white shadow-md border border-[#D4E1EE]/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#DDB549]/15 text-[#DDB549] border border-[#DDB549]/30">
                  Authorized Healthcare Network
                </span>
                <span className="text-xs text-[#EDF3F7] font-mono">
                  {data?.activeProfile?.ayuvSaathiId || "AYUV-LIVE"}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                One Secure Health Identity · Synchronized with Authorized Care Professionals
              </h2>
              <p className="text-xs text-[#D4E1EE] max-w-2xl">
                Your medical records, lab reports, doctor summaries, and prescriptions are shared securely. Select an authorized portal to view the care provider experience:
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleSwitchDomain("doctor")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-[#D4E1EE]/30 text-white text-xs font-bold transition-all shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-[#DDB549]"
              >
                <Stethoscope className="w-3.5 h-3.5 text-[#DDB549]" />
                <span>Doctor Portal</span>
              </button>

            </div>
          </div>
          <div className="flex flex-col xl:flex-row gap-5 justify-center items-start">
            {/* Main Center Dashboard Column: ~885px */}
            <div className="flex-1 max-w-full xl:max-w-[885px] space-y-4">
              {/* 1. Welcome Banner Card */}
              <div className="bg-gradient-to-r from-[#EDF3F7] via-[#F2F7FA] to-[#EDF3F7] border border-[#D4E1EE] rounded-2xl p-5 flex items-center justify-between relative overflow-hidden shadow-2xs">
                <div className="max-w-[480px]">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-[#D4E1EE] text-[#08193C] text-[10px] font-bold uppercase tracking-wider mb-2">
                    <Sparkles className="w-3 h-3 text-[#DDB549]" />
                    {getIstGreeting()}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-[#08193C] tracking-tight leading-tight">
                    {t("welcomeBack", { name: displayName })}
                  </h1>
                  <p className="text-xs text-[#465978] mt-1 leading-relaxed">
                    {t("welcomeSubtitle")}
                  </p>
                </div>

                <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#08193C] block leading-tight">
                      {t("healthyMindTag")} ♡
                    </span>
                  </div>
                  {/* Decorative Meditating Healthcare Figure */}
                  <div className="w-20 h-20 rounded-full bg-white border border-[#D4E1EE] flex items-center justify-center text-[#08193C] relative shadow-2xs">
                    <HeartPulse className="w-9 h-9 text-[#08193C]" />
                    <Sparkles className="w-3.5 h-3.5 text-[#DDB549] absolute top-1 right-2" />
                  </div>
                </div>
              </div>

              {/* 2. Four Summary Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                {/* Card 1: Lab Reports */}
                <div className="bg-white border border-[#D4E1EE] rounded-2xl p-3.5 flex flex-col justify-between h-[103px] shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#EDF3F7] text-[#08193C] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[#465978] leading-tight">{t("statLabReports")}</p>
                      <p className="text-xl font-bold text-[#08193C] leading-tight mt-0.5">
                        {data?.stats?.labReportsCount ?? 4}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/reports"
                    className="text-[10px] font-bold text-[#08193C] hover:text-[#DDB549] hover:underline flex items-center gap-1 self-start"
                  >
                    {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                </div>

                {/* Card 2: Upcoming Reminders */}
                <div className="bg-white border border-[#D4E1EE] rounded-2xl p-3.5 flex flex-col justify-between h-[103px] shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#FFFDF5] text-[#DDB549] border border-[#DDB549]/30 flex items-center justify-center shrink-0">
                      <Pill className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[#465978] leading-tight">{t("statReminders")}</p>
                      <p className="text-xl font-bold text-[#08193C] leading-tight mt-0.5">
                        {data?.stats?.remindersCount ?? 2}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/reminders"
                    className="text-[10px] font-bold text-[#08193C] hover:text-[#DDB549] hover:underline flex items-center gap-1 self-start"
                  >
                    {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                </div>

                {/* Card 3: Active Treatment Plans */}
                <div className="bg-white border border-[#D4E1EE] rounded-2xl p-3.5 flex flex-col justify-between h-[103px] shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#EDF3F7] text-[#08193C] flex items-center justify-center shrink-0">
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[#465978] leading-tight">{t("statTreatmentPlans")}</p>
                      <p className="text-xl font-bold text-[#08193C] leading-tight mt-0.5">
                        {data?.stats?.treatmentPlansCount ?? 0}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/doctor-summary"
                    className="text-[10px] font-bold text-[#08193C] hover:text-[#DDB549] hover:underline flex items-center gap-1 self-start"
                  >
                    {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                </div>

                {/* Card 4: Medical Records */}
                <div className="bg-white border border-[#D4E1EE] rounded-2xl p-3.5 flex flex-col justify-between h-[103px] shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#FFFDF5] text-[#DDB549] border border-[#DDB549]/30 flex items-center justify-center shrink-0">
                      <FolderHeart className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[#465978] leading-tight">{t("statMedicalRecords")}</p>
                      <p className="text-xl font-bold text-[#08193C] leading-tight mt-0.5">
                        {data?.stats?.medicalRecordsCount ?? 8}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/timeline"
                    className="text-[10px] font-bold text-[#08193C] hover:text-[#DDB549] hover:underline flex items-center gap-1 self-start"
                  >
                    {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                </div>
              </div>

              {/* 3. Mid Section: Health Trends Panel + Recent Activity Timeline */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                {/* Health Trends Panel (7 Cols) */}
                <div className="md:col-span-7 bg-white border border-[#D4E1EE] rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2 border-b border-[#D4E1EE]">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[#08193C]" />
                      <div>
                        <h3 className="text-xs font-bold text-[#08193C]">{t("healthTrendsTitle")}</h3>
                        <p className="text-[10px] text-[#465978]">{t("healthTrendsSubtitle")}</p>
                      </div>
                    </div>
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value as "3" | "6" | "12")}
                      className="text-[10px] font-semibold text-[#465978] border border-[#D4E1EE] bg-[#EDF3F7] rounded-lg px-2 py-1 outline-hidden cursor-pointer"
                    >
                      <option value="3">{t("timeLast3Months")}</option>
                      <option value="6">{t("timeLast6Months")}</option>
                      <option value="12">{t("timeLastYear")}</option>
                    </select>
                  </div>

                  {chartData.length > 0 ? (
                    <>
                      <div className="mt-3 flex items-start justify-between">
                        <div>
                          <span className="text-[11px] font-bold text-[#08193C]">{t("bloodGlucoseLabel")}</span>
                          <div className="flex items-center gap-3 mt-1 text-[9px] text-[#465978]">
                            <span className="flex items-center gap-1">
                              <span className="w-2.5 h-0.5 bg-[#08193C] inline-block rounded"></span> {t("yourValue")}
                            </span>
                          </div>
                        </div>

                        <div className="bg-[#EDF3F7] border border-[#D4E1EE] rounded-xl p-2.5 text-center min-w-[120px]">
                          <span className="text-[9px] text-[#465978] font-semibold block uppercase">{t("latestValue")}</span>
                          <div className="text-lg font-extrabold text-[#08193C] leading-tight mt-0.5">
                            {latestGlucose?.value} <span className="text-xs font-medium text-[#465978]">mg/dL</span>
                          </div>
                          <span className="text-[9px] text-[#9AA5B4] block mt-0.5">{latestGlucose?.date}</span>
                        </div>
                      </div>

                      <div className="w-full h-36 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#D4E1EE" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#465978" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: "#465978" }} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{ backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #D4E1EE", fontSize: "11px" }}
                            />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="#08193C"
                              strokeWidth={2.5}
                              dot={{ r: 3.5, fill: "#DDB549", stroke: "#08193C", strokeWidth: 1.5 }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  ) : (
                    <p className="py-10 text-center text-xs text-[#9AA5B4]">
                      {loading ? common("loading") : t("noVerifiedData")}
                    </p>
                  )}
                </div>

                {/* Recent Activity Timeline (5 Cols) */}
                <div className="md:col-span-5 bg-white border border-[#D4E1EE] rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2 border-b border-[#D4E1EE]">
                    <h3 className="text-xs font-bold text-[#08193C]">{t("recentActivityTitle")}</h3>
                    <Link href="/timeline" className="text-[10px] font-bold text-[#08193C] hover:text-[#DDB549] hover:underline flex items-center gap-1">
                      {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                    </Link>
                  </div>

                  <div className="mt-2.5 space-y-3 relative pl-3 border-l-2 border-[#D4E1EE] ml-2">
                    {dynamicActivities.length > 0 ? dynamicActivities.map((act) => (
                      <div key={act.id} className="relative group">
                        <span className={`w-2 h-2 rounded-full ${act.color} absolute -left-[17px] top-1 ring-4 ring-white`} />
                        <div className="flex items-start justify-between">
                          <p className="text-[11px] font-bold text-[#08193C] leading-tight">{act.title}</p>
                          <span className="text-[9px] text-[#9AA5B4] font-medium">{act.time}</span>
                        </div>
                        <p className="text-[10px] text-[#465978] mt-0.5 leading-snug">{act.desc}</p>
                      </div>
                    )) : (
                      <p className="py-4 text-xs text-[#9AA5B4]">{loading ? common("loading") : t("noVerifiedData")}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Lower Cards: Recent Lab Reports (6 Cols) + Active Treatment Plans (6 Cols) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Recent Lab Reports Card */}
                <div className="bg-white border border-[#D4E1EE] rounded-2xl p-4 shadow-2xs">
                  <div className="flex items-center justify-between pb-2.5 border-b border-[#D4E1EE]">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#08193C]" />
                      <h3 className="text-xs font-bold text-[#08193C]">{t("recentLabReportsTable")}</h3>
                    </div>
                    <Link href="/reports" className="text-[10px] font-bold text-[#08193C] hover:text-[#DDB549] hover:underline flex items-center gap-1">
                      {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                    </Link>
                  </div>

                  <div className="mt-2.5 space-y-2">
                    {dynamicLabReports.length > 0 ? dynamicLabReports.map((report) => (
                      <Link
                        key={report.id}
                        href={`/reports/${report.id}`}
                        className="p-2.5 rounded-xl border border-[#D4E1EE] bg-[#FDFEFE] flex items-center justify-between hover:bg-[#EDF3F7] hover:border-[#08193C]/30 transition-colors block"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#EDF3F7] text-[#08193C] flex items-center justify-center shrink-0">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-[#08193C] leading-tight">{report.name}</p>
                            <p className="text-[9px] text-[#465978]">{report.date} · {report.source}</p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-[#EDF3F7] text-[#08193C] border border-[#D4E1EE] text-[9px] font-bold rounded-full">
                          ✓ {t("statusProcessed")}
                        </span>
                      </Link>
                    )) : (
                      <p className="py-4 text-xs text-[#9AA5B4]">{loading ? common("loading") : t("noVerifiedData")}</p>
                    )}
                  </div>
                </div>

                {/* Active Treatment Plans Card */}
                <div className="bg-white border border-[#D4E1EE] rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#D4E1EE]">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-[#08193C]" />
                        <h3 className="text-xs font-bold text-[#08193C]">{t("activeTreatmentPlansTable")}</h3>
                      </div>
                      <Link href="/doctor-summary" className="text-[10px] font-bold text-[#08193C] hover:text-[#DDB549] hover:underline flex items-center gap-1">
                        {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                      </Link>
                    </div>

                    <div className="mt-3">
                      <p className="py-4 text-xs text-[#9AA5B4]">
                        {loading ? common("loading") : t("noVerifiedData")}
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/doctor-summary"
                    className="mt-3 w-full py-1.5 px-3 rounded-xl border border-[#D4E1EE] hover:bg-[#EDF3F7] text-[11px] font-bold text-[#08193C] flex items-center justify-center gap-1 transition-colors"
                  >
                    {t("viewDetails")} <ArrowRight className="w-3 h-3 text-[#DDB549]" />
                  </Link>
                </div>
              </div>

              {/* 5. Lower Row: Recent Medical Records Card with Accurate Routing */}
              <div className="bg-white border border-[#D4E1EE] rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-[#D4E1EE]">
                  <div className="flex items-center gap-2">
                    <FolderHeart className="w-4 h-4 text-[#08193C]" />
                    <h3 className="text-xs font-bold text-[#08193C]">{t("recentMedicalRecordsTable")}</h3>
                  </div>
                  <Link href="/timeline" className="text-[10px] font-bold text-[#08193C] hover:text-[#DDB549] hover:underline flex items-center gap-1">
                    {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                </div>

                <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {dynamicMedicalRecords.length > 0 ? dynamicMedicalRecords.map((rec) => (
                    <Link
                      key={rec.key}
                      href={rec.href}
                      className="p-2.5 rounded-xl border border-[#D4E1EE] bg-[#FDFEFE] flex items-center justify-between hover:bg-[#EDF3F7] hover:border-[#08193C]/30 transition-all group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#EDF3F7] text-[#08193C] flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-[#08193C] leading-tight group-hover:text-[#DDB549] transition-colors">
                            {rec.title}
                          </p>
                          <p className="text-[9px] text-[#465978]">{rec.date}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-[#9AA5B4] group-hover:translate-x-0.5 group-hover:text-[#08193C] transition-all" />
                    </Link>
                  )) : (
                    <p className="py-4 text-xs text-[#9AA5B4]">{loading ? common("loading") : t("noVerifiedData")}</p>
                  )}
                </div>
              </div>

              {/* 6. My Connected Doctors (Section 8 of Specification) */}
              <div className="bg-white border border-[#D4E1EE] rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-[#D4E1EE]">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-[#08193C]" />
                    <h3 className="text-xs font-bold text-[#08193C]">My Connected Doctors</h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EDF3F7] text-[#08193C] border border-[#D4E1EE]">
                    {data?.connections?.filter((c) => c.professionalRole === "doctor").length ?? 0} Connected
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(data?.connections?.filter((c) => c.professionalRole === "doctor") ?? []).length > 0 ? (
                    data?.connections
                      ?.filter((c) => c.professionalRole === "doctor")
                      .map((doc) => (
                        <div
                          key={doc.id}
                          className="p-3.5 rounded-xl border border-[#D4E1EE] bg-[#FDFEFE] flex flex-col justify-between space-y-3"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-[#08193C]">{doc.professionalName}</span>
                              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] font-semibold">
                                {doc.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#465978] mt-0.5">
                              {doc.specialization || "General Physician"} • {doc.organizationName}
                            </p>
                            <p className="text-[10px] text-[#9AA5B4] mt-0.5">
                              Last interaction: {new Date(doc.lastInteractionAt).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-[#D4E1EE]">
                            <Link
                              href="/assistant"
                              className="flex-1 py-1 px-2.5 rounded-lg bg-white border border-[#D4E1EE] hover:bg-[#EDF3F7] text-[11px] font-semibold text-[#08193C] text-center transition-colors"
                            >
                              Message
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDoctorForEmergency(doc);
                                setEmergencyModalOpen(true);
                              }}
                              className="flex-1 py-1 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-[11px] font-bold text-red-700 text-center transition-colors cursor-pointer"
                            >
                              Emergency Alert
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeConnection(doc.id)}
                              className="py-1 px-2 rounded-lg bg-[#EDF3F7] hover:bg-red-50 text-[10px] font-semibold text-[#465978] hover:text-red-700 transition-colors cursor-pointer"
                              title="Revoke doctor collaboration access"
                            >
                              Revoke
                            </button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="col-span-2 p-4 text-center text-xs text-[#465978] bg-[#EDF3F7] rounded-xl border border-[#D4E1EE]">
                      No doctors connected to this profile yet. Doctors can connect by scanning your Universal Health QR code.
                    </div>
                  )}
                </div>
              </div>

              {/* Personalized Wellness Recommendations (Section 3.3 of Specification) */}
              <div className="bg-white border border-[#D4E1EE] rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#D4E1EE] gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#08193C] text-[#DDB549] flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-[#DDB549]" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#08193C]">
                        Personalized Wellness & Lifestyle Guidance
                      </h3>
                      <p className="text-[11px] text-[#465978]">
                        Tailored lifestyle advice based on your conditions, test values, and age.
                      </p>
                    </div>
                  </div>
                  {data?.wellnessAnalysis && (
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="text-[11px] font-bold text-[#08193C] bg-[#EDF3F7] border border-[#DDB549]/40 px-3 py-1 rounded-full">
                        Wellness Vitality Score: {data.wellnessAnalysis.overallWellnessScore}/100
                      </span>
                    </div>
                  )}
                </div>

                {/* Category Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#EDF3F7] border border-[#D4E1EE] rounded-xl text-xs font-semibold">
                  {(["all", "diet", "activity", "sleep", "habits"] as const).map((cat) => {
                    const active = selectedWellnessCategory === cat;
                    const labels: Record<string, string> = {
                      all: `All Recommendations (${allWellnessRecs.length})`,
                      diet: "🥗 Diet & Nutrition",
                      activity: "🏃 Physical Activity",
                      sleep: "🌙 Sleep & Rest",
                      habits: "✨ Habits & Monitoring",
                    };
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedWellnessCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs ${
                          active
                            ? "bg-[#08193C] text-white font-bold shadow-xs border-b-2 border-[#DDB549]"
                            : "text-[#465978] hover:text-[#08193C]"
                        }`}
                      >
                        {labels[cat]}
                      </button>
                    );
                  })}
                </div>

                {/* Recommendations List */}
                <div className="grid grid-cols-1 gap-3.5 pt-1">
                  {filteredWellnessRecs.length > 0 ? (
                    filteredWellnessRecs.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-4 rounded-xl border border-[#D4E1EE] bg-[#FDFEFE] hover:bg-[#EDF3F7]/50 transition-colors space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#08193C] text-white">
                              {rec.category}
                            </span>
                            <h4 className="font-bold text-xs sm:text-sm text-[#08193C]">
                              {rec.title}
                            </h4>
                          </div>
                          <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EDF3F7] text-[#465978] border border-[#D4E1EE] self-start sm:self-auto">
                            {rec.evidenceTag}
                          </span>
                        </div>

                        <p className="text-xs text-[#465978] leading-relaxed font-normal">
                          {rec.advice}
                        </p>

                        {/* Why this is recommended for you */}
                        <div className="p-3 rounded-xl bg-[#FFFDF5] border border-[#DDB549]/40 text-xs text-[#08193C] space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-[#08193C]">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#DDB549] shrink-0" />
                            <span>Why this is recommended for you:</span>
                          </div>
                          <p className="text-[11px] text-[#465978] leading-relaxed pl-5">
                            {rec.whyRecommended}
                          </p>
                        </div>

                        {/* Action Steps */}
                        {rec.actionSteps && rec.actionSteps.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <p className="text-[10px] font-bold text-[#08193C] uppercase tracking-wide">
                              Actionable Steps:
                            </p>
                            <div className="space-y-1">
                              {rec.actionSteps.map((step, sIdx) => (
                                <div key={sIdx} className="flex items-start gap-2 text-xs text-[#465978]">
                                  <Check className="w-3.5 h-3.5 text-[#08193C] mt-0.5 shrink-0" />
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-[#9AA5B4] bg-[#EDF3F7] rounded-xl border border-[#D4E1EE]">
                      No recommendations found in this category.
                    </div>
                  )}
                </div>

                {/* Wellness Safety Disclaimer */}
                <div className="p-3 rounded-xl bg-[#EDF3F7] border border-[#D4E1EE] text-[11px] text-[#465978] flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#DDB549] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong className="text-[#08193C]">General Wellness Advice:</strong> These personalized suggestions provide general lifestyle, diet, and wellness tips based on your health records. Please consult with your physician before beginning any new exercise or dietary regimen.
                  </p>
                </div>
              </div>

              {/* 7. Pharmacy Dispensed Medications & Bills (Section 17 of Specification) */}
              <div className="bg-white border border-[#D4E1EE] rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-[#D4E1EE]">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#08193C]" />
                    <h3 className="text-xs font-bold text-[#08193C]">Pharmacy Bills & Dispensed Medicines</h3>
                  </div>
                  <span className="text-[10px] text-[#465978] font-semibold">
                    Purchase Record ≠ Prescription
                  </span>
                </div>

                <div className="space-y-2">
                  {(data?.pharmacyBills ?? []).length > 0 ? (
                    data?.pharmacyBills?.map((bill) => (
                      <div
                        key={bill.id}
                        className="p-3 rounded-xl border border-[#D4E1EE] bg-[#FDFEFE] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-[#08193C]">
                            {bill.pharmacyName} • Bill #{bill.id}
                          </div>
                          <div className="text-[11px] text-[#465978] mt-0.5">
                            {new Date(bill.billDate).toLocaleDateString()} • {bill.items?.map((i) => `${i.quantity}x ${i.medicineName}`).join(", ") || "Medicines"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-[#08193C] text-sm">
                            ₹{bill.totalAmount}
                          </div>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32]">
                            {bill.paymentStatus}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-[#9AA5B4] bg-[#EDF3F7] rounded-xl border border-[#D4E1EE]">
                      No pharmacy purchases recorded for this profile yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Utility Column: ~352px */}
            <div className="w-full xl:w-[352px] space-y-4 shrink-0">
              {/* Universal Patient Health QR Card */}
              <UniversalPatientQR
                patientProfileId={activeProfileId || data?.activeProfile?.id || (data?.user as any)?.id || "user"}
                patientName={data?.activeProfile?.name || data?.user?.displayName || "You"}
                ayuvSaathiId={data?.activeProfile?.ayuvSaathiId || "AS-P-PRIMARY"}
              />

              {/* 1. Medicine Reminders (~260px) */}
              <div className="bg-white border border-[#D4E1EE] rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-[#D4E1EE]">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#08193C]" />
                    <h3 className="text-xs font-bold text-[#08193C]">{t("medicineRemindersTitle")}</h3>
                  </div>
                  <Link href="/reminders" className="text-[10px] font-bold text-[#08193C] hover:text-[#DDB549] hover:underline flex items-center gap-1">
                    {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                </div>

                <div className="mt-3 space-y-2.5">
                  {dynamicReminders.length > 0 ? dynamicReminders.map((med) => (
                    <div
                      key={med.id}
                      className="p-2.5 rounded-xl border border-[#D4E1EE] bg-[#FDFEFE] hover:bg-[#EDF3F7] transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg ${med.iconBg} flex items-center justify-center shrink-0 font-bold`}>
                            <Pill className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#08193C] leading-tight">{med.name}</p>
                            <p className="text-[10px] text-[#465978] mt-0.5">{med.instruction}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 ${med.badgeColor} text-[10px] font-bold rounded-full`}>
                          {med.status}
                        </span>
                      </div>

                      {med.isPending && (
                        <div className="flex items-center gap-1.5 pt-1 border-t border-[#D4E1EE]">
                          <button
                            type="button"
                            onClick={() => handleConfirmDose(med.id)}
                            className="flex-1 py-1 px-2 rounded-lg bg-[#08193C] hover:bg-[#122958] text-white text-[10px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-2xs focus-visible:outline-2 focus-visible:outline-[#DDB549]"
                          >
                            <Check className="w-3 h-3 text-[#DDB549]" /> Taken
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSnoozeDose(med.id, 15)}
                            className="py-1 px-2 rounded-lg bg-[#EDF3F7] hover:bg-[#D4E1EE] border border-[#D4E1EE] text-[#08193C] text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-0.5"
                            title="Snooze reminder by 15 mins"
                          >
                            <Clock className="w-3 h-3 text-[#DDB549]" /> +15m
                          </button>
                        </div>
                      )}
                    </div>
                  )) : (
                    <p className="py-4 text-xs text-[#9AA5B4]">{loading ? common("loading") : t("noVerifiedData")}</p>
                  )}
                </div>
              </div>

              {/* 2. Prominent Navy & Gold AI Health Assistant Card */}
              <div className="bg-gradient-to-br from-[#08193C] via-[#0C2353] to-[#08193C] border border-[#D4E1EE]/20 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-[#DDB549]/30 flex items-center justify-center text-[#DDB549] shrink-0">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{t("aiAssistantCardTitle")}</h3>
                    <p className="text-[10px] text-[#D4E1EE] mt-0.5 leading-snug">
                      {t("aiAssistantCardDesc")}
                    </p>
                  </div>
                </div>

                <Link
                  href="/assistant"
                  className="mt-4 w-full py-2.5 px-4 rounded-xl bg-[#DDB549] hover:bg-[#E5C25F] text-[#08193C] text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {t("startConversation")} <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                {/* Suggested prompt chips matching reference image */}
                <div className="mt-3.5 grid grid-cols-2 gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handlePromptClick(t("chipExplainReport"))}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-left font-medium border border-white/15 text-white transition-colors cursor-pointer"
                  >
                    {t("chipExplainReport")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePromptClick(t("chipSummarizeRecords"))}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-left font-medium border border-white/15 text-white transition-colors cursor-pointer"
                  >
                    {t("chipSummarizeRecords")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePromptClick(t("chipWhatMeans"))}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-left font-medium border border-white/15 text-white transition-colors cursor-pointer"
                  >
                    {t("chipWhatMeans")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePromptClick(t("chipDoctorQuestions"))}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-left font-medium border border-white/15 text-white transition-colors cursor-pointer"
                  >
                    {t("chipDoctorQuestions")}
                  </button>
                </div>
              </div>

              {/* 3. Quick Actions 2x2 Grid */}
              <div className="bg-white border border-[#D4E1EE] rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center gap-2 pb-2.5 border-b border-[#D4E1EE]">
                  <Zap className="w-4 h-4 text-[#08193C]" />
                  <h3 className="text-xs font-bold text-[#08193C]">{t("quickActionsTitle")}</h3>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <Link
                    href="/reports"
                    className="p-3 bg-[#FDFEFE] border border-[#D4E1EE] hover:border-[#DDB549] hover:bg-[#EDF3F7] rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#EDF3F7] text-[#08193C] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Upload className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-[#08193C] text-center leading-tight">
                      {t("qaUploadReport")}
                    </span>
                  </Link>

                  <Link
                    href="/prescriptions"
                    className="p-3 bg-[#FDFEFE] border border-[#D4E1EE] hover:border-[#DDB549] hover:bg-[#EDF3F7] rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#EDF3F7] text-[#08193C] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Pill className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-[#08193C] text-center leading-tight">
                      {t("qaAddPrescription")}
                    </span>
                  </Link>

                  <Link
                    href="/find-care"
                    className="p-3 bg-[#FDFEFE] border border-[#D4E1EE] hover:border-[#DDB549] hover:bg-[#EDF3F7] rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#EDF3F7] text-[#DDB549] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-[#08193C] text-center leading-tight">
                      {t("qaFindNearbyCare")}
                    </span>
                  </Link>

                  <Link
                    href="/analytics"
                    className="p-3 bg-[#FDFEFE] border border-[#D4E1EE] hover:border-[#DDB549] hover:bg-[#EDF3F7] rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#EDF3F7] text-[#08193C] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-[#08193C] text-center leading-tight">
                      {t("viewAnalytics")}
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Discreet Footer */}
          <footer className="mt-8 pt-4 border-t border-[#D4E1EE] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#465978] gap-2 pb-6">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#08193C]">AyuvSaathi</span>
              <span>|</span>
              <span>{common("tagline")}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#DDB549]" />
              <span>{t("dataSafe")}</span>
              <Activity className="w-4 h-4 text-[#08193C] ml-1" />
            </div>
          </footer>
          </div>
        </main>
      </div>

      {/* Doctor Emergency Modal with Mandatory Disclaimer */}
      {emergencyModalOpen && selectedDoctorForEmergency && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-red-200 shadow-xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-bold text-red-900">
                  Doctor Emergency Channel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEmergencyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* MANDATORY DISCLAIMER */}
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-900 leading-relaxed space-y-1">
              <div className="font-bold text-red-800">
                CRITICAL EMERGENCY NOTICE
              </div>
              <p>
                This alerts <strong>{selectedDoctorForEmergency.professionalName}</strong> directly on their portal.
                It does <strong>NOT</strong> dispatch ambulances or emergency responders.
              </p>
              <p className="font-semibold text-red-800">
                For immediate life-threatening medical emergencies, dial Indian National Emergency Services:
                <strong> 108 (Ambulance)</strong> or <strong>112 (National Emergency)</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Urgent Message for Dr. {selectedDoctorForEmergency.professionalName}
              </label>
              <textarea
                rows={3}
                value={emergencyText}
                onChange={(e) => setEmergencyText(e.target.value)}
                placeholder="Describe urgent symptom or clinical change..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-red-200 focus:border-red-600 outline-hidden"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEmergencyModalOpen(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendEmergencyToDoctor}
                disabled={sendingEmergency || !emergencyText.trim()}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {sendingEmergency ? "Broadcasting..." : "Broadcast Alert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}