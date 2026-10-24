"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import {
  User,
  Stethoscope,
  FlaskConical,
  Pill,
  ArrowRight,
  ShieldCheck,
  QrCode,
  Activity,
} from "lucide-react";

export default function LandingPage() {
  const roles = [
    {
      id: "patient",
      title: "Patient & Family",
      badge: "Central Health Identity",
      description:
        "Access your personal and family health records, universal health QR, AI assistant, and health timeline.",
      icon: User,
      color: "bg-teal-600",
      border: "border-teal-200 hover:border-teal-400",
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
      color: "bg-blue-600",
      border: "border-blue-200 hover:border-blue-400",
      cta: "Open Doctor Portal",
      href: "/doctor",
      sublink: { text: "Register Doctor Profile →", href: "/auth/professional?role=doctor&mode=register" },
    },
    {
      id: "lab_tech",
      title: "Lab Technician",
      badge: "Diagnostic Partner",
      description:
        "Scan patient QR to securely associate laboratory reports, analyze biomarkers, and notify patients automatically.",
      icon: FlaskConical,
      color: "bg-indigo-600",
      border: "border-indigo-200 hover:border-indigo-400",
      cta: "Open Laboratory Portal",
      href: "/lab",
      sublink: { text: "Register Lab Profile →", href: "/auth/professional?role=lab_tech&mode=register" },
    },
    {
      id: "pharmacist",
      title: "Pharmacist",
      badge: "Pharmacy Partner",
      description:
        "Scan patient QR to inspect authorized prescriptions, dispense medications, and record transparent pharmacy bills.",
      icon: Pill,
      color: "bg-amber-600",
      border: "border-amber-200 hover:border-amber-400",
      cta: "Open Pharmacy Portal",
      href: "/pharmacy",
      sublink: { text: "Register Pharmacy Profile →", href: "/auth/professional?role=pharmacist&mode=register" },
    },
  ];

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto w-full py-6 sm:py-10 px-4 sm:px-6">
        {/* Top Header Card & Main Heading */}
        <div className="text-center space-y-4 mb-10">
          {/* Centered Brand Emblem Card matching Screenshot 2 */}
          <div className="flex justify-center">
            <div className="inline-flex flex-col items-center p-3.5 sm:p-4 rounded-2xl bg-white border border-[#E1EBF0] shadow-xs">
              <div className="relative w-14 h-14 overflow-hidden rounded-xl flex items-center justify-center mb-1.5">
                <Image
                  src="/brand/ayuvsaathi-emblem.png"
                  alt="AyuvSaathi Healthcare"
                  width={56}
                  height={56}
                  className="object-contain"
                  priority
                />
              </div>
              <h2 className="text-xl font-black text-[#17344F] tracking-tight">
                AyuvSaathi
              </h2>
              <p className="text-xs text-[#61768A] font-medium">
                Your Lifelong Health Companion
              </p>
            </div>
          </div>

          {/* Ecosystem Badge */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>AyuvSaathi Healthcare Ecosystem</span>
            </div>
          </div>

          {/* Main Question Heading */}
          <h1 className="text-3xl sm:text-5xl font-black text-[#17344F] tracking-tight">
            Who are you?
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base text-[#61768A] max-w-2xl mx-auto leading-relaxed">
            AyuvSaathi connects Patients, Doctors, Diagnostic Laboratories, and Pharmacies through one secure health identity.
          </p>
        </div>

        {/* 2-Column Responsive Grid of Healthcare Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.id}
                className={`flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-white border ${role.border} shadow-xs hover:shadow-md transition-all duration-200 group`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${role.color} text-white shadow-xs group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {role.badge}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-[#17344F] group-hover:text-[#087F8C] transition-colors">
                    {role.title}
                  </h2>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    {role.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 space-y-2.5">
                  <Link
                    href={role.href}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#17344F] hover:bg-[#087F8C] text-white text-sm font-semibold shadow-xs transition-colors"
                  >
                    <span>{role.cta}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  <div className="text-center">
                    <Link
                      href={role.sublink.href}
                      className="text-xs text-slate-500 hover:text-[#087F8C] hover:underline font-medium"
                    >
                      {role.sublink.text}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Section: Security Information matching Screenshot 3 */}
        <div className="mt-10 p-5 rounded-2xl bg-white border border-[#E1EBF0] text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#087F8C] shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <p className="leading-relaxed">
              <strong className="text-[#17344F]">Zero Raw Data in QR Codes:</strong> Encrypted, temporary QR identifiers. Authorized access only with patient role-based consent. All activities synchronized with Unified Health Timeline.
            </p>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-teal-800 bg-teal-50/80 border border-teal-200/80 px-3 py-1.5 rounded-xl shrink-0">
            <Activity className="w-4 h-4 text-teal-600" />
            <span>Unified Health Timeline</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
