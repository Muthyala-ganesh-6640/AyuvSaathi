"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useCallback, useEffect, useState } from "react";
import {
  Settings,
  User,
  Database,
  Cpu,
  MapPin,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  interfaceLanguage: "en" | "te" | "hi";
  aiLanguage: "en" | "te" | "hi";
  timezone: string;
  notifyReminders: boolean;
}

interface ServicesStatus {
  database: string;
  ai: boolean;
  maps: string;
  email: boolean;
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<ServicesStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [displayName, setDisplayName] = useState("");
  const [interfaceLanguage, setInterfaceLanguage] = useState<"en" | "te" | "hi">("en");
  const [aiLanguage, setAiLanguage] = useState<"en" | "te" | "hi">("en");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [notifyReminders, setNotifyReminders] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/me");
      if (res.status === 401) {
        router.push("/auth/sign-in");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setProfile(json.user);
        setServices(json.services);
        setDisplayName(json.user.displayName || "");
        setInterfaceLanguage(json.user.interfaceLanguage || "en");
        setAiLanguage(json.user.aiLanguage || "en");
        setTimezone(json.user.timezone || "Asia/Kolkata");
        setNotifyReminders(json.user.notifyReminders ?? true);
      }
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName,
          interfaceLanguage,
          aiLanguage,
          timezone,
          notifyReminders,
        }),
      });
      if (res.ok) {
        toast.success("Preferences saved successfully!");
        if (interfaceLanguage !== currentLocale) {
          router.replace(pathname, { locale: interfaceLanguage });
        }
      } else {
        toast.error("Failed to update preferences");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-gray-500 animate-pulse">
          {common("loading")}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto w-full">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#DDF5F0] text-[#087F8C]">
              <Settings className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#17344F] tracking-tight">
              {t("title")}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#61768A]">
            {t("subtitle")}
          </p>
        </div>

        {/* User Preferences Form */}
        <div className="bg-white rounded-xl border border-[#E1EBF0] shadow-xs p-5 sm:p-7 space-y-6">
          <form onSubmit={handleSave} className="space-y-5">
            <h3 className="font-bold text-sm sm:text-base text-[#17344F] flex items-center gap-2 border-b border-[#E9F0F3] pb-3">
              <User className="w-4 h-4 text-[#087F8C]" />
              Profile & Personalization
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#17344F] mb-1.5">
                  {t("displayName")}
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E1EBF0] focus:border-[#087F8C] focus:ring-1 focus:ring-[#087F8C] outline-hidden bg-white text-[#17344F]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  {t("email")}
                </label>
                <input
                  type="email"
                  disabled
                  value={profile?.email || ""}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 text-gray-500 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  {t("interfaceLanguage")}
                </label>
                <select
                  value={interfaceLanguage}
                  onChange={(e) => setInterfaceLanguage(e.target.value as "en" | "te" | "hi")}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden bg-white"
                >
                  <option value="en">English</option>
                  <option value="te">తెలుగు (Telugu)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  {t("aiLanguage")}
                </label>
                <select
                  value={aiLanguage}
                  onChange={(e) => setAiLanguage(e.target.value as "en" | "te" | "hi")}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden bg-white"
                >
                  <option value="en">English</option>
                  <option value="te">తెలుగు (Telugu)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  {t("timezone")}
                </label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden font-mono text-xs"
                />
              </div>

              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyReminders}
                    onChange={(e) => setNotifyReminders(e.target.checked)}
                    className="w-4 h-4 rounded text-[#087F72] focus:ring-[#087F72]"
                  />
                  <span className="text-xs font-medium text-gray-700">
                    {t("reminders")}
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-[#087F72] hover:bg-[#06665B] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? common("loading") : t("savePreferences")}
              </button>
            </div>
          </form>
        </div>

        {/* System Integrations & Health Diagnostic Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 sm:p-8 space-y-4">
          <h3 className="font-bold text-base text-[#172B3A] flex items-center gap-2 border-b border-gray-100 pb-3">
            <ShieldCheck className="w-4 h-4 text-[#087F72]" />
            {t("systemStatus")}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <Database className="w-3.5 h-3.5 text-teal-700" />
                {t("databaseService")}
              </div>
              <p className="text-xs font-medium text-emerald-700 capitalize">
                ✓ {services?.database || "Local Encrypted Store"}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <Cpu className="w-3.5 h-3.5 text-sky-700" />
                {t("aiService")}
              </div>
              <p className="text-xs font-medium text-gray-700">
                {services?.ai ? "✓ Active Model Configured" : "Local Grounded Engine"}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <MapPin className="w-3.5 h-3.5 text-amber-700" />
                {t("mapsService")}
              </div>
              <p className="text-xs font-medium text-emerald-700 capitalize">
                ✓ {services?.maps || "OpenStreetMap (Live)"}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <Mail className="w-3.5 h-3.5 text-purple-700" />
                Password Reset Delivery
              </div>
              <p className="text-xs font-medium text-gray-700">
                {services?.email ? "✓ SMTP Configured" : "Local Token (Dev Mode)"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
