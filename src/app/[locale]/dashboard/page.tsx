"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { UniversalPatientQR } from "@/components/qr/UniversalPatientQR";
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
  FlaskConical,
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
      ? data.medicines.slice(0, 3).map((med, idx) => {
          const isTaken = med.status === "taken";
          return {
            id: med.id,
            name: med.medicationName,
            instruction: `${med.scheduledTime} · Scheduled Dose`,
            status: isTaken ? t("taken") : t("upcoming"),
            badgeColor: isTaken ? "bg-[#D9F8E8] text-[#1E824C]" : "bg-[#E4F1FF] text-[#206bc4]",
            iconBg: idx === 0 ? "bg-[#DDF5F1] text-[#087F8C]" : idx === 1 ? "bg-[#FFF0DC] text-[#F59A35]" : "bg-[#FFE7E9] text-[#E03131]",
          };
        })
      : [];

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
    <div className="min-h-screen bg-[#F7FAFC] text-[#142E4D] font-sans flex flex-col antialiased selection:bg-[#DDF5F1] selection:text-[#087F8C]">
      {/* Top Application Header: 72px high */}
      <header className="h-[72px] bg-white border-b border-[#E2EDF4] px-6 flex items-center justify-between sticky top-0 z-30">
        {/* Left: Menu button + Brand block */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2EDF4] hover:bg-[#F7FAFC] text-[#142E4D] font-bold text-xs transition-colors cursor-pointer shadow-2xs"
            title={isMenuOpen ? "Close Menu" : "Open Menu"}
          >
            {isMenuOpen ? <X className="w-4 h-4 text-[#087F8C]" /> : <Menu className="w-4 h-4 text-[#087F8C]" />}
            <span className="text-xs font-bold">{isMenuOpen ? "Close" : "Menu"}</span>
          </button>
          <BrandLogo variant="header" href="/dashboard" />
        </div>

        {/* Center: Search input & Family Switcher */}
        <div className="flex-1 max-w-[640px] mx-4 flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 text-[#7B91A5] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={header("searchPlaceholder")}
              className="w-full bg-[#F7FAFC] border border-[#E2EDF4] focus:border-[#087F8C] focus:bg-white focus:ring-1 focus:ring-[#087F8C] text-xs sm:text-sm text-[#142E4D] rounded-xl pl-9 pr-16 py-2 outline-hidden transition-all placeholder:text-[#7B91A5]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#7B91A5] border border-[#E2EDF4] bg-white px-1.5 py-0.5 rounded font-medium">
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
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2EDF4] rounded-xl text-xs font-semibold text-[#142E4D] hover:bg-[#F7FAFC] transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-[#58718B]" />
              <span>{locale === "te" ? "తెలుగు" : locale === "hi" ? "हिन्दी" : "English"}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#7B91A5]" />
            </button>

            {langDropdownOpen && (
              <div className="absolute right-0 mt-1 w-32 bg-white border border-[#E2EDF4] rounded-xl shadow-lg py-1 z-40 text-xs">
                <button
                  type="button"
                  onClick={() => handleLanguageChange("en")}
                  className={`w-full text-left px-3 py-2 hover:bg-[#F7FAFC] flex items-center justify-between ${
                    locale === "en" ? "font-bold text-[#087F8C]" : "text-[#142E4D]"
                  }`}
                >
                  English {locale === "en" && <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("te")}
                  className={`w-full text-left px-3 py-2 hover:bg-[#F7FAFC] flex items-center justify-between ${
                    locale === "te" ? "font-bold text-[#087F8C]" : "text-[#142E4D]"
                  }`}
                >
                  తెలుగు {locale === "te" && <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("hi")}
                  className={`w-full text-left px-3 py-2 hover:bg-[#F7FAFC] flex items-center justify-between ${
                    locale === "hi" ? "font-bold text-[#087F8C]" : "text-[#142E4D]"
                  }`}
                >
                  हिन्दी {locale === "hi" && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* User Profile Avatar with Online Badge */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-[#F7FAFC] transition-colors cursor-pointer"
            >
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-[#17466B] text-white flex items-center justify-center text-xs font-bold ring-2 ring-[#087F8C]/20">
                  {displayName.charAt(0)}
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-[#28AD65] ring-2 ring-white absolute -bottom-0.5 -right-0.5" />
              </div>
              <div className="hidden lg:block text-left pr-1">
                <p className="text-xs font-bold text-[#142E4D] leading-tight">{displayName}</p>
                <p className="text-[10px] text-[#7B91A5] leading-tight">Patient</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#7B91A5] hidden lg:block" />
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-[#E2EDF4] rounded-xl shadow-lg py-1 z-40 text-xs">
                <div className="px-3 py-2 border-b border-[#E2EDF4]">
                  <p className="font-bold text-[#142E4D]">{displayName}</p>
                  <p className="text-[10px] text-[#7B91A5] truncate">{data?.user?.email || "patient@ayuvsaathi.in"}</p>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="w-full text-left px-3 py-2 hover:bg-[#F7FAFC] flex items-center gap-2 text-[#58718B] hover:text-[#142E4D]"
                >
                  <User className="w-3.5 h-3.5" />
                  Profile Settings
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-[#E2EDF4]"
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
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto relative">
        {/* Collapsible Menu Drawer: Hidden by default, shown when Menu button is pressed */}
        {isMenuOpen && (
          <>
            <div
              className="fixed inset-0 top-[72px] bg-slate-900/40 backdrop-blur-2xs z-30 transition-opacity"
              onClick={() => setIsMenuOpen(false)}
            />
            <aside className="fixed top-[72px] left-0 bottom-0 z-40 w-[280px] bg-white border-r border-[#E2EDF4] flex flex-col justify-between py-5 px-3 shadow-2xl animate-in slide-in-from-left duration-200 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-3 pb-2 border-b border-[#E2EDF4]">
                  <span className="text-xs font-bold text-[#7B91A5] uppercase tracking-wider">Navigation Menu</span>
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen(false)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
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
                            ? "bg-[#DDF5F1] text-[#087F8C]"
                            : "text-[#58718B] hover:bg-[#F7FAFC] hover:text-[#142E4D]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            className={`w-4 h-4 transition-colors ${
                              item.active ? "text-[#087F8C]" : "text-[#7B91A5] group-hover:text-[#087F8C]"
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>
                        {item.badge !== undefined && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              item.active ? "bg-[#087F8C] text-white" : "bg-[#E2EDF4] text-[#58718B]"
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
                <div className="pt-3 border-t border-[#E2EDF4]">
                  <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#7B91A5] mb-2">
                    Care Team Dashboards
                  </p>
                  <div className="space-y-1">
                    <Link
                      href="/doctor"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-800 hover:bg-blue-50 transition-colors"
                    >
                      <Stethoscope className="w-4 h-4 text-blue-600" />
                      <span>Doctor Workspace</span>
                    </Link>
                    <Link
                      href="/lab"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-teal-800 hover:bg-teal-50 transition-colors"
                    >
                      <FlaskConical className="w-4 h-4 text-teal-600" />
                      <span>Laboratory Portal</span>
                    </Link>
                    <Link
                      href="/pharmacy"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-800 hover:bg-amber-50 transition-colors"
                    >
                      <Pill className="w-4 h-4 text-amber-600" />
                      <span>Pharmacy Portal</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Patient Identity QR card in menu */}
              <div className="mt-6 pt-4 border-t border-[#E2EDF4]">
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

        {/* Dashboard Canvas: Full-width when menu is closed */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7 overflow-x-hidden w-full">
          {/* Healthcare Ecosystem Connected Network Hub */}
          <div className="mb-6 bg-gradient-to-r from-slate-900 via-[#17344F] to-[#0A2540] rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  Authorized Healthcare Network
                </span>
                <span className="text-xs text-slate-300 font-mono">
                  {data?.activeProfile?.ayuvSaathiId || "AYUV-LIVE"}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                One Secure Health Identity · Synchronized with Authorized Care Professionals
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl">
                Your medical records, lab reports, doctor summaries, and prescriptions are shared securely. Select an authorized portal to view the care provider experience:
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                href="/doctor"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/40 text-blue-200 hover:text-white text-xs font-bold transition-all shadow-xs"
              >
                <Stethoscope className="w-3.5 h-3.5 text-blue-300" />
                <span>Doctor Portal</span>
              </Link>
              <Link
                href="/lab"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600/30 hover:bg-teal-600/50 border border-teal-400/40 text-teal-200 hover:text-white text-xs font-bold transition-all shadow-xs"
              >
                <FlaskConical className="w-3.5 h-3.5 text-teal-300" />
                <span>Diagnostic Lab</span>
              </Link>
              <Link
                href="/pharmacy"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 border border-amber-400/40 text-amber-200 hover:text-white text-xs font-bold transition-all shadow-xs"
              >
                <Pill className="w-3.5 h-3.5 text-amber-300" />
                <span>Pharmacy Portal</span>
              </Link>
            </div>
          </div>
          <div className="flex flex-col xl:flex-row gap-5">
            {/* Main Center Dashboard Column: ~885px */}
            <div className="flex-1 max-w-full xl:max-w-[885px] space-y-4">
              {/* 1. Welcome Banner Card */}
              <div className="bg-gradient-to-r from-[#DDF5F1] via-[#E8F8F5] to-[#F0FAF7] border border-[#C5EDE3] rounded-2xl p-5 flex items-center justify-between relative overflow-hidden shadow-2xs">
                <div className="max-w-[480px]">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/80 border border-teal-200 text-[#087F8C] text-[10px] font-bold uppercase tracking-wider mb-2">
                    <Sparkles className="w-3 h-3 text-[#28AD65]" />
                    {getIstGreeting()}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-[#142E4D] tracking-tight leading-tight">
                    {t("welcomeBack", { name: displayName })}
                  </h1>
                  <p className="text-xs text-[#58718B] mt-1 leading-relaxed">
                    {t("welcomeSubtitle")}
                  </p>
                </div>

                <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#087F8C] block leading-tight">
                      {t("healthyMindTag")} ♡
                    </span>
                  </div>
                  {/* Decorative Meditating Healthcare Figure */}
                  <div className="w-20 h-20 rounded-full bg-white/70 border border-teal-200/60 flex items-center justify-center text-[#087F8C] relative shadow-2xs">
                    <HeartPulse className="w-9 h-9 text-[#087F8C]" />
                    <Sparkles className="w-3.5 h-3.5 text-[#28AD65] absolute top-1 right-2" />
                  </div>
                </div>
              </div>

              {/* 2. Four Summary Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                {/* Card 1: Lab Reports */}
                <div className="bg-white border border-[#E2EDF4] rounded-2xl p-3.5 flex flex-col justify-between h-[103px] shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#E4F1FF] text-[#3186F6] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[#58718B] leading-tight">{t("statLabReports")}</p>
                      <p className="text-xl font-bold text-[#142E4D] leading-tight mt-0.5">
                        {data?.stats?.labReportsCount ?? 4}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/reports"
                    className="text-[10px] font-bold text-[#087F8C] hover:underline flex items-center gap-1 self-start"
                  >
                    {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                </div>

                {/* Card 2: Upcoming Reminders */}
                <div className="bg-white border border-[#E2EDF4] rounded-2xl p-3.5 flex flex-col justify-between h-[103px] shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#D9F8E8] text-[#28AD65] flex items-center justify-center shrink-0">
                      <Pill className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[#58718B] leading-tight">{t("statReminders")}</p>
                      <p className="text-xl font-bold text-[#142E4D] leading-tight mt-0.5">
                        {data?.stats?.remindersCount ?? 2}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/reminders"
                    className="text-[10px] font-bold text-[#087F8C] hover:underline flex items-center gap-1 self-start"
                  >
                    {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                </div>

                {/* Card 3: Active Treatment Plans */}
                <div className="bg-white border border-[#E2EDF4] rounded-2xl p-3.5 flex flex-col justify-between h-[103px] shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#F3E8FF] text-[#8B5CE8] flex items-center justify-center shrink-0">
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[#58718B] leading-tight">{t("statTreatmentPlans")}</p>
                      <p className="text-xl font-bold text-[#142E4D] leading-tight mt-0.5">
                        {data?.stats?.treatmentPlansCount ?? 0}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/doctor-summary"
                    className="text-[10px] font-bold text-[#087F8C] hover:underline flex items-center gap-1 self-start"
                  >
                    {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                </div>

                {/* Card 4: Medical Records */}
                <div className="bg-white border border-[#E2EDF4] rounded-2xl p-3.5 flex flex-col justify-between h-[103px] shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#FFF0DC] text-[#F59A35] flex items-center justify-center shrink-0">
                      <FolderHeart className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[#58718B] leading-tight">{t("statMedicalRecords")}</p>
                      <p className="text-xl font-bold text-[#142E4D] leading-tight mt-0.5">
                        {data?.stats?.medicalRecordsCount ?? 8}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/timeline"
                    className="text-[10px] font-bold text-[#087F8C] hover:underline flex items-center gap-1 self-start"
                  >
                    {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                </div>
              </div>

              {/* 3. Mid Section: Health Trends Panel + Recent Activity Timeline */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                {/* Health Trends Panel (7 Cols) */}
                <div className="md:col-span-7 bg-white border border-[#E2EDF4] rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2EDF4]">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[#087F8C]" />
                      <div>
                        <h3 className="text-xs font-bold text-[#142E4D]">{t("healthTrendsTitle")}</h3>
                        <p className="text-[10px] text-[#7B91A5]">{t("healthTrendsSubtitle")}</p>
                      </div>
                    </div>
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value as "3" | "6" | "12")}
                      className="text-[10px] font-semibold text-[#58718B] border border-[#E2EDF4] bg-[#F7FAFC] rounded-lg px-2 py-1 outline-hidden cursor-pointer"
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
                          <span className="text-[11px] font-bold text-[#142E4D]">{t("bloodGlucoseLabel")}</span>
                          <div className="flex items-center gap-3 mt-1 text-[9px] text-[#58718B]">
                            <span className="flex items-center gap-1">
                              <span className="w-2.5 h-0.5 bg-[#087F8C] inline-block rounded"></span> {t("yourValue")}
                            </span>
                          </div>
                        </div>

                        <div className="bg-[#F7FAFC] border border-[#E2EDF4] rounded-xl p-2.5 text-center min-w-[120px]">
                          <span className="text-[9px] text-[#7B91A5] font-semibold block uppercase">{t("latestValue")}</span>
                          <div className="text-lg font-extrabold text-[#142E4D] leading-tight mt-0.5">
                            {latestGlucose?.value} <span className="text-xs font-medium text-[#58718B]">mg/dL</span>
                          </div>
                          <span className="text-[9px] text-[#7B91A5] block mt-0.5">{latestGlucose?.date}</span>
                        </div>
                      </div>

                      <div className="w-full h-36 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E6EEF4" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#7B91A5" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: "#7B91A5" }} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{ backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #E2EDF4", fontSize: "11px" }}
                            />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="#087F8C"
                              strokeWidth={2.5}
                              dot={{ r: 3.5, fill: "#087F8C", stroke: "#ffffff", strokeWidth: 1.5 }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  ) : (
                    <p className="py-10 text-center text-xs text-[#7B91A5]">
                      {loading ? common("loading") : t("noVerifiedData")}
                    </p>
                  )}
                </div>

                {/* Recent Activity Timeline (5 Cols) */}
                <div className="md:col-span-5 bg-white border border-[#E2EDF4] rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2EDF4]">
                    <h3 className="text-xs font-bold text-[#142E4D]">{t("recentActivityTitle")}</h3>
                    <Link href="/timeline" className="text-[10px] font-bold text-[#087F8C] hover:underline flex items-center gap-1">
                      {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                    </Link>
                  </div>

                  <div className="mt-2.5 space-y-3 relative pl-3 border-l-2 border-[#E2EDF4] ml-2">
                    {dynamicActivities.length > 0 ? dynamicActivities.map((act) => (
                      <div key={act.id} className="relative group">
                        <span className={`w-2 h-2 rounded-full ${act.color} absolute -left-[17px] top-1 ring-4 ring-white`} />
                        <div className="flex items-start justify-between">
                          <p className="text-[11px] font-bold text-[#142E4D] leading-tight">{act.title}</p>
                          <span className="text-[9px] text-[#7B91A5] font-medium">{act.time}</span>
                        </div>
                        <p className="text-[10px] text-[#58718B] mt-0.5 leading-snug">{act.desc}</p>
                      </div>
                    )) : (
                      <p className="py-4 text-xs text-[#7B91A5]">{loading ? common("loading") : t("noVerifiedData")}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Lower Cards: Recent Lab Reports (6 Cols) + Active Treatment Plans (6 Cols) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Recent Lab Reports Card */}
                <div className="bg-white border border-[#E2EDF4] rounded-2xl p-4 shadow-2xs">
                  <div className="flex items-center justify-between pb-2.5 border-b border-[#E2EDF4]">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#087F8C]" />
                      <h3 className="text-xs font-bold text-[#142E4D]">{t("recentLabReportsTable")}</h3>
                    </div>
                    <Link href="/reports" className="text-[10px] font-bold text-[#087F8C] hover:underline flex items-center gap-1">
                      {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                    </Link>
                  </div>

                  <div className="mt-2.5 space-y-2">
                    {dynamicLabReports.length > 0 ? dynamicLabReports.map((report) => (
                      <Link
                        key={report.id}
                        href={`/reports/${report.id}`}
                        className="p-2.5 rounded-xl border border-[#E2EDF4] bg-[#F7FAFC] flex items-center justify-between hover:bg-white hover:border-[#087F8C]/30 transition-colors block"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#E4F1FF] text-[#3186F6] flex items-center justify-center shrink-0">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-[#142E4D] leading-tight">{report.name}</p>
                            <p className="text-[9px] text-[#7B91A5]">{report.date} · {report.source}</p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-[#D9F8E8] text-[#1E824C] text-[9px] font-bold rounded-full">
                          ✓ {t("statusProcessed")}
                        </span>
                      </Link>
                    )) : (
                      <p className="py-4 text-xs text-[#7B91A5]">{loading ? common("loading") : t("noVerifiedData")}</p>
                    )}
                  </div>
                </div>

                {/* Active Treatment Plans Card */}
                <div className="bg-white border border-[#E2EDF4] rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#E2EDF4]">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-[#087F8C]" />
                        <h3 className="text-xs font-bold text-[#142E4D]">{t("activeTreatmentPlansTable")}</h3>
                      </div>
                      <Link href="/doctor-summary" className="text-[10px] font-bold text-[#087F8C] hover:underline flex items-center gap-1">
                        {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                      </Link>
                    </div>

                    <div className="mt-3">
                      <p className="py-4 text-xs text-[#7B91A5]">
                        {loading ? common("loading") : t("noVerifiedData")}
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/doctor-summary"
                    className="mt-3 w-full py-1.5 px-3 rounded-xl border border-[#E2EDF4] hover:bg-[#F7FAFC] text-[11px] font-bold text-[#087F8C] flex items-center justify-center gap-1 transition-colors"
                  >
                    {t("viewDetails")} <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* 5. Lower Row: Recent Medical Records Card with Accurate Routing */}
              <div className="bg-white border border-[#E2EDF4] rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-[#E2EDF4]">
                  <div className="flex items-center gap-2">
                    <FolderHeart className="w-4 h-4 text-[#087F8C]" />
                    <h3 className="text-xs font-bold text-[#142E4D]">{t("recentMedicalRecordsTable")}</h3>
                  </div>
                  <Link href="/timeline" className="text-[10px] font-bold text-[#087F8C] hover:underline flex items-center gap-1">
                    {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                </div>

                <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {dynamicMedicalRecords.length > 0 ? dynamicMedicalRecords.map((rec) => (
                    <Link
                      key={rec.key}
                      href={rec.href}
                      className="p-2.5 rounded-xl border border-[#E2EDF4] bg-[#F7FAFC] flex items-center justify-between hover:bg-white hover:border-[#087F8C]/30 transition-all group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#DDF5F1] text-[#087F8C] flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-[#142E4D] leading-tight group-hover:text-[#087F8C] transition-colors">
                            {rec.title}
                          </p>
                          <p className="text-[9px] text-[#7B91A5]">{rec.date}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-[#7B91A5] group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  )) : (
                    <p className="py-4 text-xs text-[#7B91A5]">{loading ? common("loading") : t("noVerifiedData")}</p>
                  )}
                </div>
              </div>

              {/* 6. My Connected Doctors (Section 8 of Specification) */}
              <div className="bg-white border border-[#E2EDF4] rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-[#E2EDF4]">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-[#087F8C]" />
                    <h3 className="text-xs font-bold text-[#142E4D]">My Connected Doctors</h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
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
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-[#17344F]">{doc.professionalName}</span>
                              <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                                {doc.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              {doc.specialization || "General Physician"} • {doc.organizationName}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Last interaction: {new Date(doc.lastInteractionAt).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                            <Link
                              href="/assistant"
                              className="flex-1 py-1 px-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 text-center transition-colors"
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
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="col-span-2 p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                      No doctors connected to this profile yet. Doctors can connect by scanning your Universal Health QR code.
                    </div>
                  )}
                </div>
              </div>

              {/* 7. Pharmacy Dispensed Medications & Bills (Section 17 of Specification) */}
              <div className="bg-white border border-[#E2EDF4] rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-[#E2EDF4]">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-bold text-[#142E4D]">Pharmacy Bills & Dispensed Medicines</h3>
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    Purchase Record ≠ Prescription
                  </span>
                </div>

                <div className="space-y-2">
                  {(data?.pharmacyBills ?? []).length > 0 ? (
                    data?.pharmacyBills?.map((bill) => (
                      <div
                        key={bill.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-800">
                            {bill.pharmacyName} • Bill #{bill.id}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {new Date(bill.billDate).toLocaleDateString()} • {bill.items?.map((i) => `${i.quantity}x ${i.medicineName}`).join(", ") || "Medicines"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-amber-900 text-sm">
                            ₹{bill.totalAmount}
                          </div>
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                            {bill.paymentStatus}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
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
              <div className="bg-white border border-[#E2EDF4] rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-[#E2EDF4]">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#087F8C]" />
                    <h3 className="text-xs font-bold text-[#142E4D]">{t("medicineRemindersTitle")}</h3>
                  </div>
                  <Link href="/reminders" className="text-[10px] font-bold text-[#087F8C] hover:underline flex items-center gap-1">
                    {t("viewAll")} <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                </div>

                <div className="mt-3 space-y-2.5">
                  {dynamicReminders.length > 0 ? dynamicReminders.map((med) => (
                    <div
                      key={med.id}
                      className="p-2.5 rounded-xl border border-[#E2EDF4] bg-[#F7FAFC] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg ${med.iconBg} flex items-center justify-center shrink-0 font-bold`}>
                          <Pill className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#142E4D] leading-tight">{med.name}</p>
                          <p className="text-[10px] text-[#7B91A5] mt-0.5">{med.instruction}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 ${med.badgeColor} text-[10px] font-bold rounded-full`}>
                        {med.status}
                      </span>
                    </div>
                  )) : (
                    <p className="py-4 text-xs text-[#7B91A5]">{loading ? common("loading") : t("noVerifiedData")}</p>
                  )}
                </div>
              </div>

              {/* 2. Prominent Teal AI Health Assistant Card */}
              <div className="bg-gradient-to-br from-[#087F8C] to-[#07545B] rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{t("aiAssistantCardTitle")}</h3>
                    <p className="text-[10px] text-teal-100 mt-0.5 leading-snug">
                      {t("aiAssistantCardDesc")}
                    </p>
                  </div>
                </div>

                <Link
                  href="/assistant"
                  className="mt-4 w-full py-2.5 px-4 rounded-xl bg-white hover:bg-teal-50 text-[#087F8C] text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {t("startConversation")} <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                {/* Suggested prompt chips matching reference image */}
                <div className="mt-3.5 grid grid-cols-2 gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handlePromptClick(t("chipExplainReport"))}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-left font-medium border border-white/15 transition-colors cursor-pointer"
                  >
                    {t("chipExplainReport")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePromptClick(t("chipSummarizeRecords"))}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-left font-medium border border-white/15 transition-colors cursor-pointer"
                  >
                    {t("chipSummarizeRecords")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePromptClick(t("chipWhatMeans"))}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-left font-medium border border-white/15 transition-colors cursor-pointer"
                  >
                    {t("chipWhatMeans")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePromptClick(t("chipDoctorQuestions"))}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-left font-medium border border-white/15 transition-colors cursor-pointer"
                  >
                    {t("chipDoctorQuestions")}
                  </button>
                </div>
              </div>

              {/* 3. Quick Actions 2x2 Grid */}
              <div className="bg-white border border-[#E2EDF4] rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center gap-2 pb-2.5 border-b border-[#E2EDF4]">
                  <Zap className="w-4 h-4 text-[#087F8C]" />
                  <h3 className="text-xs font-bold text-[#142E4D]">{t("quickActionsTitle")}</h3>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <Link
                    href="/reports"
                    className="p-3 bg-[#F7FAFC] border border-[#E2EDF4] hover:border-[#087F8C]/40 hover:bg-white rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#E4F1FF] text-[#087F8C] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Upload className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-[#142E4D] text-center leading-tight">
                      {t("qaUploadReport")}
                    </span>
                  </Link>

                  <Link
                    href="/prescriptions"
                    className="p-3 bg-[#F7FAFC] border border-[#E2EDF4] hover:border-[#087F8C]/40 hover:bg-white rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#DDF5F1] text-[#087F8C] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Pill className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-[#142E4D] text-center leading-tight">
                      {t("qaAddPrescription")}
                    </span>
                  </Link>

                  <Link
                    href="/find-care"
                    className="p-3 bg-[#F7FAFC] border border-[#E2EDF4] hover:border-[#087F8C]/40 hover:bg-white rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#FFF0DC] text-[#F59A35] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-[#142E4D] text-center leading-tight">
                      {t("qaFindNearbyCare")}
                    </span>
                  </Link>

                  <Link
                    href="/analytics"
                    className="p-3 bg-[#F7FAFC] border border-[#E2EDF4] hover:border-[#087F8C]/40 hover:bg-white rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#F3E8FF] text-[#8B5CE8] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold text-[#142E4D] text-center leading-tight">
                      {t("viewAnalytics")}
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Discreet Footer */}
          <footer className="mt-8 pt-4 border-t border-[#E2EDF4] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#7B91A5] gap-2 pb-6">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#087F8C]">AyuvSaathi</span>
              <span>|</span>
              <span>{common("tagline")}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#28AD65]" />
              <span>{t("dataSafe")}</span>
              <Activity className="w-4 h-4 text-[#087F8C] ml-1" />
            </div>
          </footer>
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