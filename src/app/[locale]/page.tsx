"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  FileText,
  FileCheck2,
  Pill,
  Languages,
  MapPin,
  ClipboardList,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Lock,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";

export default function LandingPage() {
  const t = useTranslations("landing");
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);

  const handleExploreDemo = async () => {
    // If not signed in, redirect to sign in or create demo account
    setSeeding(true);
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" });
      if (res.ok) {
        toast.success("Demo data loaded! Navigating to dashboard...");
        router.push("/dashboard");
      } else if (res.status === 401) {
        toast.info("Please sign in or create an account to view the personalized dashboard.");
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
      toast.error("Unable to contact the server to load demo records.");
    } finally {
      setSeeding(false);
    }
  };

  const features = [
    {
      title: t("feature1Title"),
      desc: t("feature1Desc"),
      icon: FileText,
      color: "bg-teal-50 text-[#087F72] border-teal-200",
    },
    {
      title: t("feature2Title"),
      desc: t("feature2Desc"),
      icon: FileCheck2,
      color: "bg-sky-50 text-sky-700 border-sky-200",
    },
    {
      title: t("feature3Title"),
      desc: t("feature3Desc"),
      icon: Pill,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      title: t("feature4Title"),
      desc: t("feature4Desc"),
      icon: Languages,
      color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
    {
      title: t("feature5Title"),
      desc: t("feature5Desc"),
      icon: MapPin,
      color: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      title: t("feature6Title"),
      desc: t("feature6Desc"),
      icon: ClipboardList,
      color: "bg-purple-50 text-purple-700 border-purple-200",
    },
  ];

  return (
    <AppShell>
      <div className="space-y-16 py-4">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="flex justify-center">
            <BrandLogo variant="auth" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EFF9F5] border border-teal-200 text-[#087F8C] text-xs font-semibold tracking-wide shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            {t("badge")}
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-[#17344F] tracking-tight leading-tight sm:leading-tight">
            {t("title")}
          </h1>

          <p className="text-base sm:text-lg text-[#61768A] leading-relaxed max-w-2xl mx-auto">
            {t("subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/auth/sign-up"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#087F8C] hover:bg-[#07545B] text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all"
            >
              {t("getStarted")}
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/auth/sign-in"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-[#F7FAFC] text-[#17344F] font-semibold text-sm border border-[#E1EBF0] shadow-xs transition-all"
            >
              {t("signIn")}
            </Link>

            <button
              type="button"
              onClick={handleExploreDemo}
              disabled={seeding}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#EFF9F5] hover:bg-[#DDF5F0] text-[#087F8C] font-semibold text-sm border border-teal-200 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {seeding ? "Loading..." : t("exploreDemo")}
            </button>
          </div>

          <div className="pt-4 flex items-center justify-center gap-6 text-xs text-[#8294A4]">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-gray-400" />
              Row Level Security Isolation
            </span>
            <span>•</span>
            <span>No Unverified AI Hallucinations</span>
            <span>•</span>
            <span>English • తెలుగు</span>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="p-6 bg-white rounded-xl border border-[#E1EBF0] shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border mb-4 ${feat.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-[#17344F] mb-2">{feat.title}</h3>
                  <p className="text-xs sm:text-sm text-[#61768A] leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Clinical Transparency Callout */}
        <div className="bg-white border border-[#E1EBF0] rounded-xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h3 className="text-lg sm:text-xl font-bold text-[#17344F]">
              Designed for Patient Safety & Clinical Integrity
            </h3>
            <p className="text-xs sm:text-sm text-[#61768A] leading-relaxed">
              Medical decisions require exactness. AyuvSaathi displays source reference ranges directly from your laboratory, marks unreadable handwriting honestly, preserves numerical values verbatim, and provides multilingual explanations without altering underlying records.
            </p>
          </div>
          <Link
            href="/auth/sign-up"
            className="shrink-0 px-5 py-2.5 rounded-xl bg-[#087F8C] hover:bg-[#07545B] text-white text-xs sm:text-sm font-semibold shadow-xs"
          >
            {t("getStarted")}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
