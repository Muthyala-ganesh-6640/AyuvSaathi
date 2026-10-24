"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import {
  User,
  Stethoscope,
  ArrowRight,
  ShieldCheck,
  QrCode,
  Activity,
  Sparkles,
} from "lucide-react";

export default function LandingPage() {
  const currentLocale = useLocale();

  const handleQuickDemoLogin = async (role: "patient" | "doctor") => {
    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, locale: currentLocale || "en" }),
      });
      const data = await res.json();
      if (res.ok && data.targetDashboard) {
        toast.success(`Entering ${role === "doctor" ? "Doctor Portal" : "Patient Dashboard"}...`);
        window.location.href = data.targetDashboard;
      } else {
        toast.error("Demo access unavailable");
      }
    } catch {
      toast.error("Network error during demo login");
    }
  };

  const roles = [
    {
      id: "patient",
      title: "Patient & Family",
      badge: "Central Health Identity",
      description:
        "Access your personal and family health records, universal health QR, AI assistant, and health timeline.",
      icon: User,
      cta: "Patient Dashboard",
      href: "/dashboard",
      sublink: { text: "New patient? Create account →", href: "/auth/sign-up" },
    },
    {
      id: "doctor",
      title: "Doctor",
      badge: "Authorized Care",
      description:
        "Scan patient QR, review permitted clinical records, prescribe medications, and initiate direct doctor communications.",
      icon: Stethoscope,
      cta: "Open Doctor Portal",
      href: "/doctor",
      sublink: { text: "Register Doctor Profile →", href: "/auth/professional?role=doctor&mode=register" },
    },
  ];

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto w-full py-6 sm:py-10 px-4 sm:px-6">
        {/* Top Header Card & Main Heading */}
        <div className="text-center space-y-4 mb-10">
          {/* Centered Brand Emblem Card */}
          <div className="flex justify-center">
            <div className="inline-flex flex-col items-center p-4 sm:p-5 rounded-2xl bg-white border border-[#D4E1EE] shadow-xs">
              <div className="relative w-14 h-14 overflow-hidden rounded-xl flex items-center justify-center mb-1.5 p-1 bg-[#EDF3F7] border border-[#D4E1EE]">
                <Image
                  src="/brand/ayuvsaathi-emblem.png"
                  alt="AyuvSaathi Healthcare"
                  width={56}
                  height={56}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="flex items-center gap-1">
                <h2 className="text-xl font-black text-[#08193C] tracking-tight">
                  AyuvSaathi
                </h2>
                <span className="w-1.5 h-1.5 rounded-full bg-[#DDB549]" />
              </div>
              <p className="text-xs text-[#465978] font-medium mt-0.5">
                Your Lifelong Health Companion
              </p>
            </div>
          </div>

          {/* Ecosystem Badge */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#EDF3F7] border border-[#D4E1EE] text-[#08193C] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#DDB549]" />
              <span>AyuvSaathi Healthcare Ecosystem</span>
            </div>
          </div>

          {/* Main Question Heading */}
          <h1 className="text-3xl sm:text-5xl font-black text-[#08193C] tracking-tight">
            Who are you?
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base text-[#465978] max-w-2xl mx-auto leading-relaxed">
            AyuvSaathi connects Patients and Doctors through one secure health identity.
          </p>
        </div>

        {/* 2-Column Responsive Grid of Healthcare Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.id}
                className="flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-white border border-[#D4E1EE] hover:border-[#DDB549] shadow-xs hover:shadow-md transition-all duration-200 group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#DDB549]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#08193C] text-[#DDB549] shadow-xs group-hover:scale-105 transition-transform border border-[#08193C]">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#EDF3F7] text-[#08193C] border border-[#D4E1EE]">
                      {role.badge}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-[#08193C] group-hover:text-[#122958] transition-colors">
                    {role.title}
                  </h2>
                  <p className="text-sm text-[#465978] mt-2 leading-relaxed">
                    {role.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#D4E1EE] space-y-2.5">
                  <Link
                    href={role.href}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#08193C] hover:bg-[#122958] text-white text-sm font-semibold shadow-xs transition-colors border border-[#08193C] focus:ring-2 focus:ring-[#DDB549]"
                  >
                    <span>{role.cta}</span>
                    <ArrowRight className="w-4 h-4 text-[#DDB549] group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin(role.id as "patient" | "doctor")}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#EDF3F7] hover:bg-[#D4E1EE] text-[#08193C] text-xs font-bold transition-colors cursor-pointer border border-[#D4E1EE] shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#DDB549]" />
                    <span>Instant Demo {role.id === "doctor" ? "Doctor" : "Patient"} Access</span>
                  </button>

                  <div className="text-center pt-1">
                    <Link
                      href={role.sublink.href}
                      className="text-xs text-[#465978] hover:text-[#08193C] hover:underline font-medium"
                    >
                      {role.sublink.text}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Section: Security Information */}
        <div className="mt-10 p-5 rounded-2xl bg-white border border-[#D4E1EE] text-xs text-[#465978] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs text-center sm:text-left max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EDF3F7] border border-[#D4E1EE] flex items-center justify-center text-[#08193C] shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <p className="leading-relaxed">
              <strong className="text-[#08193C]">Zero Raw Data in QR Codes:</strong> Encrypted, temporary QR identifiers. Authorized access only with patient role-based consent. All activities synchronized with Unified Health Timeline.
            </p>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-[#08193C] bg-[#EDF3F7] border border-[#D4E1EE] px-3 py-1.5 rounded-xl shrink-0">
            <Activity className="w-4 h-4 text-[#DDB549]" />
            <span>Unified Health Timeline</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
