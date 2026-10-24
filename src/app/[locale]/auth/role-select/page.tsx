"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BrandLogo } from "@/components/brand/BrandLogo";
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

export default function RoleSelectPage() {
  const roles = [
    {
      id: "patient",
      title: "Patient & Family",
      badge: "Central Health Identity",
      description:
        "Access your personal and family health records, universal health QR, AI assistant, and health timeline.",
      icon: User,
      color: "from-emerald-500 to-teal-600",
      border: "border-teal-200 hover:border-teal-500",
      bgLight: "bg-teal-50",
      cta: "Access Patient Dashboard",
      href: "/auth/sign-in",
      sublink: { text: "New patient? Create account", href: "/auth/sign-up" },
    },
    {
      id: "doctor",
      title: "Doctor",
      badge: "Authorized Care",
      description:
        "Scan patient QR, review permitted clinical records, prescribe medications, and initiate direct doctor communications.",
      icon: Stethoscope,
      color: "from-blue-600 to-cyan-700",
      border: "border-blue-200 hover:border-blue-500",
      bgLight: "bg-blue-50",
      cta: "Open Doctor Portal",
      href: "/auth/professional?role=doctor",
      sublink: { text: "Register Doctor Profile", href: "/auth/professional?role=doctor&mode=register" },
    },
    {
      id: "lab_tech",
      title: "Lab Technician",
      badge: "Diagnostic Network",
      description:
        "Scan patient QR to securely associate laboratory reports, analyze biomarkers, and notify patients automatically.",
      icon: FlaskConical,
      color: "from-purple-600 to-indigo-700",
      border: "border-purple-200 hover:border-purple-500",
      bgLight: "bg-purple-50",
      cta: "Open Laboratory Portal",
      href: "/auth/professional?role=lab_tech",
      sublink: { text: "Register Lab Profile", href: "/auth/professional?role=lab_tech&mode=register" },
    },
    {
      id: "pharmacist",
      title: "Pharmacist",
      badge: "Pharmacy Network",
      description:
        "Scan patient QR to inspect authorized prescriptions, dispense medications, and record transparent pharmacy bills.",
      icon: Pill,
      color: "from-amber-500 to-orange-600",
      border: "border-amber-200 hover:border-amber-500",
      bgLight: "bg-amber-50",
      cta: "Open Pharmacy Portal",
      href: "/auth/professional?role=pharmacist",
      sublink: { text: "Register Pharmacy Profile", href: "/auth/professional?role=pharmacist&mode=register" },
    },
  ];

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto w-full py-8 px-4 sm:px-6">
        <div className="text-center space-y-3 mb-10">
          <div className="flex justify-center mb-2">
            <BrandLogo variant="auth" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>AyuvSaathi Healthcare Ecosystem</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#17344F] tracking-tight">
            Who are you?
          </h1>
          <p className="text-sm sm:text-base text-[#61768A] max-w-xl mx-auto">
            AyuvSaathi connects Patients, Doctors, Diagnostic Laboratories, and Pharmacies through one secure health identity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.id}
                className={`relative flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-white border ${role.border} shadow-sm hover:shadow-md transition-all duration-200 group`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-tr ${role.color} text-white shadow-xs group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {role.badge}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-[#17344F] group-hover:text-[#087F72] transition-colors">
                    {role.title}
                  </h2>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    {role.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                  <Link
                    href={role.href}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#17344F] hover:bg-[#087F72] text-white text-sm font-semibold shadow-xs transition-colors"
                  >
                    <span>{role.cta}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  <div className="text-center">
                    <Link
                      href={role.sublink.href}
                      className="text-xs text-slate-500 hover:text-[#087F72] hover:underline font-medium"
                    >
                      {role.sublink.text}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Ecosystem Guarantee Note */}
        <div className="mt-10 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-teal-700 shrink-0" />
            <span>
              <strong>Zero Raw Data in QR Codes:</strong> Patient QR codes contain encrypted ephemeral identifiers. Only authorized professionals can resolve records through role-based consent.
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-teal-800 shrink-0">
            <Activity className="w-4 h-4 text-teal-600" />
            <span>Unified Health Timeline</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
