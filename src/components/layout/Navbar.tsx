"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  Search,
  Bell,
  Globe,
  ChevronDown,
  Sparkles,
  LogOut,
  Settings,
  Menu,
  X,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface NavbarProps {
  user?: { displayName?: string; email?: string; role?: string } | null;
  onRefresh?: () => void;
  onToggleMenu?: () => void;
  isMenuOpen?: boolean;
  showMenuButton?: boolean;
}

export function Navbar({ user, onRefresh, onToggleMenu, isMenuOpen = false, showMenuButton = true }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const h = useTranslations("header");
  const common = useTranslations("common");

  const [searchQuery, setSearchQuery] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const isDoctor = user?.role === "doctor" || pathname.includes("/doctor");
  const shouldDisplayMenuButton = showMenuButton && !isDoctor;
  const homeHref = isDoctor ? "/doctor" : "/dashboard";

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
        const message = body?.message || body?.error || "Failed to load demo records";
        toast.error(message);
      }
    } catch {
      toast.error("Error loading demo records.");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <header className="h-[72px] bg-white border-b border-[#D4E1EE] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shrink-0">
      {/* Left: Menu button + Brand block */}
      <div className="flex items-center gap-2">
        {shouldDisplayMenuButton && user && onToggleMenu && (
          <button
            type="button"
            onClick={onToggleMenu}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D4E1EE] hover:bg-[#EDF3F7] text-[#08193C] transition-colors cursor-pointer"
            title={isMenuOpen ? "Hide Menu" : "Show Menu"}
          >
            {isMenuOpen ? <X className="w-4 h-4 text-[#DDB549]" /> : <Menu className="w-4 h-4 text-[#08193C]" />}
            <span className="text-xs font-bold">{isMenuOpen ? "Close" : "Menu"}</span>
          </button>
        )}
        <BrandLogo variant="header" href={homeHref} />
      </div>

      {/* Center: Search input */}
      <div className="flex-1 max-w-[560px] mx-4 hidden md:block">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <Search className="w-4 h-4 text-[#9AA5B4] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={h("searchPlaceholder")}
            className="w-full bg-[#EDF3F7] border border-[#D4E1EE] focus:border-[#DDB549] focus:bg-white focus:ring-1 focus:ring-[#DDB549] text-xs sm:text-sm text-[#08193C] rounded-xl pl-9 pr-16 py-2.5 outline-hidden transition-all placeholder:text-[#9AA5B4]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#465978] border border-[#D4E1EE] bg-white px-1.5 py-0.5 rounded font-medium shadow-2xs">
            Ctrl + K
          </span>
        </form>
      </div>

      {/* Right: Portal Switcher, Quick actions, Notifications, Language, Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Healthcare Ecosystem Portal Switcher (only shown after login) */}
        {user && (
          <div className="hidden lg:flex items-center gap-1 p-1 bg-[#EDF3F7] border border-[#D4E1EE] rounded-xl text-xs font-semibold">
            <Link
              href="/dashboard"
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                pathname.includes("/dashboard")
                  ? "bg-[#08193C] text-white shadow-xs"
                  : "text-[#465978] hover:text-[#08193C]"
              }`}
            >
              Patient
            </Link>
            <Link
              href="/doctor"
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                pathname.includes("/doctor")
                  ? "bg-[#08193C] text-white shadow-xs"
                  : "text-[#465978] hover:text-[#08193C]"
              }`}
            >
              Doctor
            </Link>
          </div>
        )}
        {user && (
          <button
            type="button"
            onClick={handleSeedDemo}
            disabled={seeding}
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#D4E1EE] bg-[#EDF3F7] text-[#08193C] text-xs font-semibold hover:bg-[#D4E1EE] transition-colors cursor-pointer"
            title={h("loadDemo")}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#DDB549]" />
            {seeding ? common("loading") : h("loadDemo")}
          </button>
        )}

        {/* Notification Bell (only shown after login) */}
        {user && (
          <button
            type="button"
            className="relative p-2 text-[#465978] hover:text-[#08193C] hover:bg-[#EDF3F7] rounded-xl transition-colors cursor-pointer"
            title={h("notifications")}
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#DDB549] ring-2 ring-white" />
          </button>
        )}

        {/* Language Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#D4E1EE] bg-white text-xs font-medium text-[#08193C] hover:bg-[#EDF3F7] transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-[#DDB549]" />
            <span className="hidden sm:inline">
              {locale === "te" ? "తెలుగు" : "English"}
            </span>
            <ChevronDown className="w-3 h-3 text-[#9AA5B4]" />
          </button>

          {langDropdownOpen && (
            <div className="absolute right-0 mt-2 w-36 bg-white border border-[#D4E1EE] rounded-xl shadow-lg p-1 z-50 animate-in fade-in zoom-in-95">
              <button
                type="button"
                onClick={() => handleLanguageChange("en")}
                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-between ${
                  locale === "en"
                    ? "bg-[#EDF3F7] text-[#08193C] font-bold"
                    : "text-[#465978] hover:bg-[#EDF3F7] hover:text-[#08193C]"
                }`}
              >
                <span>English</span>
                {locale === "en" && <span className="text-[10px] text-[#DDB549] font-bold">✓</span>}
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange("te")}
                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-between ${
                  locale === "te"
                    ? "bg-[#EDF3F7] text-[#08193C] font-bold"
                    : "text-[#465978] hover:bg-[#EDF3F7] hover:text-[#08193C]"
                }`}
              >
                <span>తెలుగు</span>
                {locale === "te" && <span className="text-[10px] text-[#DDB549] font-bold">✓</span>}
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
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-[#EDF3F7] transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-[#08193C] border border-[#DDB549] flex items-center justify-center text-white font-bold text-xs uppercase shadow-xs">
                {user.displayName ? user.displayName.slice(0, 2) : "AS"}
              </div>
              <div className="hidden lg:flex flex-col text-left leading-tight">
                <span className="text-xs font-bold text-[#08193C]">
                  {user.displayName || "Patient"}
                </span>
                <span className="text-[10px] text-[#465978]">{h("verifiedPatient")}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-[#9AA5B4] hidden lg:block" />
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-[#D4E1EE] rounded-xl shadow-lg p-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-[#D4E1EE] mb-1">
                  <p className="text-xs font-bold text-[#08193C]">
                    {user.displayName || "Patient"}
                  </p>
                  <p className="text-[11px] text-[#465978] truncate">{user.email}</p>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-[#08193C] hover:bg-[#EDF3F7] rounded-lg transition-colors font-medium"
                >
                  <Settings className="w-3.5 h-3.5 text-[#DDB549]" />
                  {h("settingsProfile")}
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#C93B46] hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-left font-medium"
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
            className="px-4 py-2 rounded-xl bg-[#08193C] hover:bg-[#122958] text-white text-xs font-bold shadow-xs transition-colors border border-[#08193C] focus:ring-2 focus:ring-[#DDB549]"
          >
            {h("signIn")}
          </Link>
        )}
      </div>
    </header>
  );
}
