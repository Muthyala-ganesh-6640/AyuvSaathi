"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { toast } from "sonner";
import { Lock, Mail, ArrowRight, Sparkles } from "lucide-react";

export default function SignInPage() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const router = useRouter();
  const currentLocale = useLocale();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const executeSignIn = async (userEmail: string, userPass: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: userEmail, password: userPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Sign in failed");
      } else {
        toast.success("Welcome back! Redirecting...");
        const targetLocale = data.language || currentLocale || "en";
        if (data.targetDashboard) {
          window.location.href = data.targetDashboard;
        } else if (data.role === "doctor") {
          window.location.href = `/${targetLocale}/doctor`;
        } else {
          window.location.href = `/${targetLocale}/dashboard`;
        }
      }
    } catch {
      toast.error("Network error during sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (role: "patient" | "doctor") => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, locale: currentLocale || "en" }),
      });
      const data = await res.json();
      if (res.ok && data.targetDashboard) {
        toast.success(`Welcome! Logged in as Demo ${role === "doctor" ? "Doctor" : "Patient"}`);
        window.location.href = data.targetDashboard;
      } else {
        toast.error("Demo login failed");
      }
    } catch {
      toast.error("Network error during demo login");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your email and password.");
      return;
    }
    await executeSignIn(email, password);
  };

  return (
    <AppShell>
      <div className="max-w-md mx-auto w-full py-8 px-4 sm:px-6">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#D4E1EE] shadow-sm space-y-6">
          <div className="text-center space-y-2 flex flex-col items-center">
            <BrandLogo variant="auth" className="justify-center mb-1" />
            <h1 className="text-2xl font-bold text-[#08193C]">{t("signInTitle")}</h1>
            <p className="text-xs text-[#465978]">{t("subtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#08193C] mb-1.5">
                {t("email")}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#465978] absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#D4E1EE] focus:border-[#08193C] focus:ring-2 focus:ring-[#DDB549]/30 outline-hidden transition-all text-[#08193C] placeholder:text-[#9AA5B4]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#08193C]">
                  {t("password")}
                </label>
                <Link
                  href="/auth/reset"
                  className="text-xs text-[#08193C] hover:text-[#122958] hover:underline font-medium"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#465978] absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#D4E1EE] focus:border-[#08193C] focus:ring-2 focus:ring-[#DDB549]/30 outline-hidden transition-all text-[#08193C] placeholder:text-[#9AA5B4]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#08193C] hover:bg-[#122958] text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? common("loading") : t("signInTitle")}
              <ArrowRight className="w-4 h-4 text-[#DDB549]" />
            </button>
          </form>

          {/* Quick Demo Instant Access */}
          <div className="pt-4 border-t border-[#D4E1EE] space-y-2.5">
            <p className="text-[10px] font-bold text-center text-[#465978] uppercase tracking-wider">
              Explore AyuvSaathi with Instant Demo
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("patient")}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#EDF3F7] hover:bg-[#D4E1EE] text-[#08193C] text-xs font-bold transition-colors cursor-pointer border border-[#D4E1EE] shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#DDB549]" />
                <span>Demo Patient</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("doctor")}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#08193C] hover:bg-[#122958] text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#DDB549]" />
                <span>Demo Doctor</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-[#D4E1EE] text-center text-xs text-[#465978]">
            <span>{t("dontHaveAccount")} </span>
            <Link
              href="/auth/sign-up"
              className="font-semibold text-[#08193C] hover:underline ml-1"
            >
              {common("signUp")}
            </Link>
          </div>

          <div className="pt-1 text-center text-xs">
            <Link
              href="/auth/professional?role=doctor"
              className="text-[#465978] hover:text-[#08193C] font-medium transition-colors"
            >
              Doctor? Open Doctor Portal →
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
