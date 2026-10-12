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
        <div className="fixed inset-0 z-50 lg:hidden bg-black/40 backdrop-blur-xs flex">
          <div className="w-80 bg-white h-full shadow-2xl flex flex-col p-4 animate-in slide-in-from-left">
            <div className="flex items-center justify-between pb-4 border-b border-[#E1EBF0]">
              <BrandLogo variant="header" />
              <button
                type="button"
                onClick={() => setOpenDrawer(false)}
                className="p-1.5 rounded-xl text-gray-500 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="mt-3 space-y-1 overflow-y-auto flex-1">
              {fullNav.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpenDrawer(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#DDF5F0] text-[#087F8C] font-bold"
                        : "text-[#17344F] hover:bg-[#F7FAFC]"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? "text-[#087F8C]" : "text-[#61768A]"
                      }`}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex-1" onClick={() => setOpenDrawer(false)} />
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E1EBF0] lg:hidden px-3 py-1.5 flex items-center justify-around shadow-md">
        {mainTabs.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                isActive
                  ? "text-[#087F8C] font-bold"
                  : "text-[#61768A] hover:text-[#17344F]"
              }`}
            >
              <Icon
                className={`w-5 h-5 mb-0.5 ${
                  isActive ? "text-[#087F8C]" : "text-[#8294A4]"
                }`}
              />
              <span className="truncate max-w-[65px]">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenDrawer(true)}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium text-[#61768A] hover:text-[#17344F] cursor-pointer"
        >
          <Menu className="w-5 h-5 mb-0.5 text-[#8294A4]" />
          <span>{common("more")}</span>
        </button>
      </nav>
    </>
  );
}
