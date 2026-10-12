"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  Search,
  Bell,
  Globe,
  ChevronDown,
  LogOut,
  Sparkles,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface NavbarProps {
  user?: { displayName?: string; email?: string } | null;
  onRefresh?: () => void;
}

export function Navbar({ user, onRefresh }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const h = useTranslations("header");
  const common = useTranslations("common");

  const [searchQuery, setSearchQuery] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
      toast.success("Signed out successfully");
      router.push("/auth/sign-in");
    } catch {
      toast.error("Sign out failed");
    }
  };

  const handleLanguageChange = (newLocale: "en" | "te") => {
    setLangDropdownOpen(false);
    router.replace(pathname, { locale: newLocale });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/reports?search=${encodeURIComponent(searchQuery)}`);
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" });
      if (res.ok) {
        toast.success("Demo health records loaded successfully!");
        if (onRefresh) onRefresh();
        else router.refresh();
      } else if (res.status === 401) {
        toast.error("Your session has expired. Please sign in to load demo records.");
        router.push("/auth/sign-in");
      } else {
        const body = await res.json().catch(() => null);
        const message =
          body && typeof body.error === "string"
            ? body.error
            : `Demo records could not be loaded (HTTP ${res.status}). Please try again.`;
        toast.error(message);
      }
    } catch {
      toast.error("Error loading demo records.");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <header className="h-[72px] bg-white border-b border-[#E1EBF0] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shrink-0">
      {/* Left: Brand block matching the 245px sidebar width */}
      <div className="w-[235px] shrink-0 flex items-center">
        <BrandLogo variant="header" href="/dashboard" />
      </div>

      {/* Center: Search input */}
      <div className="flex-1 max-w-[560px] mx-4 hidden md:block">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <Search className="w-4 h-4 text-[#8294A4] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={h("searchPlaceholder")}
            className="w-full bg-[#F7FAFC] border border-[#E1EBF0] focus:border-[#087F8C] focus:bg-white focus:ring-1 focus:ring-[#087F8C] text-xs sm:text-sm text-[#17344F] rounded-xl pl-9 pr-16 py-2.5 outline-hidden transition-all placeholder:text-[#8294A4]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#8294A4] border border-[#E1EBF0] bg-white px-1.5 py-0.5 rounded font-medium">
            Ctrl + K
          </span>
        </form>
      </div>

      {/* Right: Quick actions, Notifications, Language, Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {user && (
          <button
            type="button"
            onClick={handleSeedDemo}
            disabled={seeding}
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-teal-200 bg-teal-50/70 text-[#087F8C] text-xs font-semibold hover:bg-teal-100 transition-colors cursor-pointer"
            title={h("loadDemo")}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {seeding ? common("loading") : h("loadDemo")}
          </button>
        )}

        {/* Notification Bell */}
        <button
          type="button"
          className="relative p-2 text-[#61768A] hover:text-[#17344F] hover:bg-[#F7FAFC] rounded-xl transition-colors cursor-pointer"
          title={h("notifications")}
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D94B55] ring-2 ring-white" />
        </button>

        {/* Language Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#E1EBF0] bg-white text-xs font-medium text-[#17344F] hover:bg-[#F7FAFC] transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-[#087F8C]" />
            <span className="hidden sm:inline">
              {locale === "te" ? "తెలుగు" : "English"}
            </span>
            <ChevronDown className="w-3 h-3 text-[#8294A4]" />
          </button>

          {langDropdownOpen && (
            <div className="absolute right-0 mt-2 w-36 bg-white border border-[#E1EBF0] rounded-xl shadow-lg p-1 z-50 animate-in fade-in zoom-in-95">
              <button
                type="button"
                onClick={() => handleLanguageChange("en")}
                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-between ${
                  locale === "en"
                    ? "bg-[#DDF5F0] text-[#087F8C] font-semibold"
                    : "text-[#17344F] hover:bg-gray-50"
                }`}
              >
                <span>English</span>
                {locale === "en" && <span className="text-[10px]">✓</span>}
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange("te")}
                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-between ${
                  locale === "te"
                    ? "bg-[#DDF5F0] text-[#087F8C] font-semibold"
                    : "text-[#17344F] hover:bg-gray-50"
                }`}
              >
                <span>తెలుగు</span>
                {locale === "te" && <span className="text-[10px]">✓</span>}
              </button>
            </div>
          )}
        </div>

        {/* User Profile Dropdown or Sign In link */}
        {user ? (
          <div className="relative pl-1 sm:pl-2">
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-[#F7FAFC] transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-[#DDF5F0] border border-teal-200 flex items-center justify-center text-[#087F8C] font-bold text-xs uppercase shadow-xs">
                {user.displayName ? user.displayName.slice(0, 2) : "AS"}
              </div>
              <div className="hidden lg:flex flex-col text-left leading-tight">
                <span className="text-xs font-bold text-[#17344F]">
                  {user.displayName || "Patient"}
                </span>
                <span className="text-[10px] text-[#61768A]">{h("verifiedPatient")}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-[#8294A4] hidden lg:block" />
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-[#E1EBF0] rounded-xl shadow-lg p-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-[#E9F0F3] mb-1">
                  <p className="text-xs font-bold text-[#17344F]">
                    {user.displayName || "Patient"}
                  </p>
                  <p className="text-[11px] text-[#61768A] truncate">{user.email}</p>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-[#17344F] hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-[#087F8C]" />
                  {h("settingsProfile")}
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#D94B55] hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-left font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {h("signOut")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/auth/sign-in"
            className="px-3 py-1.5 rounded-xl bg-[#087F8C] hover:bg-[#07545B] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            {h("signIn")}
          </Link>
        )}
      </div>
    </header>
  );
}
