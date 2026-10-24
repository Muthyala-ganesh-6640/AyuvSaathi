"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  LayoutDashboard,
  Bot,
  FileText,
  Pill,
  Menu,
  X,
  FileCheck2,
  FolderHeart,
  BarChart3,
  MapPin,
  ClipboardList,
  Settings,
} from "lucide-react";
import { useState } from "react";

export function MobileNav() {
  const t = useTranslations("nav");
  const common = useTranslations("common");
  const pathname = usePathname();
  const [openDrawer, setOpenDrawer] = useState(false);

  const mainTabs = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/reports", label: t("reports"), icon: FileText },
    { href: "/reminders", label: t("reminders"), icon: Pill },
    { href: "/assistant", label: t("assistant"), icon: Bot },
  ];

  const fullNav = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/reports", label: t("reports"), icon: FileText },
    { href: "/doctor-summary", label: t("doctorSummary"), icon: ClipboardList },
    { href: "/timeline", label: t("timeline"), icon: FolderHeart },
    { href: "/assistant", label: t("assistant"), icon: Bot },
    { href: "/prescriptions", label: t("prescriptions"), icon: FileCheck2 },
    { href: "/reminders", label: t("reminders"), icon: Pill },
    { href: "/analytics", label: t("analytics"), icon: BarChart3 },
    { href: "/find-care", label: t("findCare"), icon: MapPin },
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {openDrawer && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-900/60 backdrop-blur-2xs flex">
          <div className="w-80 bg-white h-full shadow-2xl flex flex-col p-4 animate-in slide-in-from-left">
            <div className="flex items-center justify-between pb-4 border-b border-[#D4E1EE]">
              <BrandLogo variant="header" />
              <button
                type="button"
                onClick={() => setOpenDrawer(false)}
                className="p-1.5 rounded-xl text-[#465978] hover:bg-[#EDF3F7] cursor-pointer"
              >
                <X className="w-5 h-5 text-[#08193C]" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 space-y-1">
              {fullNav.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpenDrawer(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-[#EDF3F7] text-[#08193C] border-l-4 border-[#DDB549]"
                        : "text-[#465978] hover:bg-[#EDF3F7] hover:text-[#08193C]"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? "text-[#DDB549]" : "text-[#9AA5B4]"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div
            className="flex-1"
            onClick={() => setOpenDrawer(false)}
          />
        </div>
      )}

      {/* Bottom Sticky Tab Bar for Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#D4E1EE] flex items-center justify-around py-2 px-3 z-40 shadow-lg">
        {mainTabs.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-semibold transition-colors ${
                isActive
                  ? "text-[#08193C] font-bold"
                  : "text-[#465978] hover:text-[#08193C]"
              }`}
            >
              <Icon
                className={`w-5 h-5 mb-0.5 ${
                  isActive ? "text-[#DDB549]" : "text-[#9AA5B4]"
                }`}
              />
              <span className="truncate max-w-[65px]">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenDrawer(true)}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-semibold text-[#465978] hover:text-[#08193C] cursor-pointer"
        >
          <Menu className="w-5 h-5 mb-0.5 text-[#9AA5B4]" />
          <span>{common("more")}</span>
        </button>
      </nav>
    </>
  );
}
