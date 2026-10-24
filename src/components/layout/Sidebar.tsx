"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
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
  ShieldCheck,
  Building2,
  X,
} from "lucide-react";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/reports", label: t("reports"), icon: FileText },
    { href: "/discharge-summary", label: t("dischargeSummary"), icon: Building2 },
    { href: "/doctor-summary", label: t("doctorSummary"), icon: ClipboardList },
    { href: "/timeline", label: t("timeline"), icon: FolderHeart },
    { href: "/assistant", label: t("assistant"), icon: Bot },
    { href: "/prescriptions", label: t("prescriptions"), icon: FileCheck2 },
    { href: "/reminders", label: t("reminders"), icon: Pill, badge: 3 },
    { href: "/analytics", label: t("analytics"), icon: BarChart3 },
    { href: "/find-care", label: t("findCare"), icon: MapPin },
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  return (
    <aside className="w-[280px] shrink-0 bg-white border-r border-[#D4E1EE] flex flex-col justify-between p-4 h-[calc(100vh-72px)] overflow-y-auto z-20 shadow-xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1 pb-3 border-b border-[#D4E1EE]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#08193C] text-[#DDB549] flex items-center justify-center shadow-2xs">
              <LayoutDashboard className="w-3.5 h-3.5 text-[#DDB549]" />
            </div>
            <span className="text-xs font-bold text-[#08193C] uppercase tracking-wider">Navigation Menu</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#EDF3F7] text-[#465978] hover:text-[#08193C] transition-colors cursor-pointer"
              title="Close Menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onClose && onClose()}
                className={`relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all group overflow-hidden ${
                  isActive
                    ? "bg-[#EDF3F7] text-[#08193C] font-bold shadow-2xs"
                    : "text-[#465978] hover:bg-[#EDF3F7] hover:text-[#08193C]"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#DDB549]" />
                )}
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? "text-[#DDB549]" : "text-[#465978] group-hover:text-[#08193C]"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="w-5 h-5 rounded-full bg-[#DDB549] text-[#08193C] text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-[#D4E1EE] text-[11px] text-[#465978] flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-[#DDB549] shrink-0" />
        <span>Role-Verified Clinical Isolation</span>
      </div>
    </aside>
  );
}
