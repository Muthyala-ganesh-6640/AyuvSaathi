"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { toast } from "sonner";
import { Lock, Mail, ArrowRight } from "lucide-react";

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
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E1EBF0] shadow-sm space-y-6">
          <div className="text-center space-y-2 flex flex-col items-center">
            <BrandLogo variant="auth" className="justify-center mb-1" />
            <h1 className="text-2xl font-bold text-[#17344F]">{t("signInTitle")}</h1>
            <p className="text-xs text-[#61768A]">{t("subtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {t("email")}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] focus:ring-1 focus:ring-[#087F72] outline-hidden transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700">
                  {t("password")}
                </label>
                <Link
                  href="/auth/reset"
                  className="text-xs text-[#087F72] hover:underline"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] focus:ring-1 focus:ring-[#087F72] outline-hidden transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#087F72] hover:bg-[#06665B] text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? common("loading") : t("signInTitle")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-2 border-t border-gray-100 text-center text-xs text-gray-500">
            <span>{t("dontHaveAccount")} </span>
            <Link
              href="/auth/sign-up"
              className="font-semibold text-[#087F72] hover:underline ml-1"
            >
              {common("signUp")}
            </Link>
          </div>

          <div className="pt-1 text-center text-xs">
            <Link
              href="/auth/professional?role=doctor"
              className="text-[#17344F] hover:text-[#087F72] font-medium transition-colors"
            >
              Doctor? Open Doctor Portal →
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
