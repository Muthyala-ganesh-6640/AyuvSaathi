"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Mail, User, Globe, ArrowRight } from "lucide-react";

export default function SignUpPage() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "te" | "hi">(
    currentLocale as "en" | "te" | "hi"
  );
  const [loading, setLoading] = useState(false);

  const handleLanguageChange = (lang: "en" | "te" | "hi") => {
    setSelectedLanguage(lang);
    router.replace(pathname, { locale: lang });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !email || !password) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName,
          email,
          password,
          interfaceLanguage: selectedLanguage,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Sign up failed");
      } else {
        toast.success("Account created successfully!");
        router.push("/dashboard");
      }
    } catch {
      toast.error("Network error during registration.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-md mx-auto w-full py-8">
        <div className="bg-white p-6 sm:p-8 rounded-xl border border-[#E1EBF0] shadow-xs space-y-6">
          <div className="text-center space-y-2 flex flex-col items-center">
            <BrandLogo variant="auth" className="justify-center mb-1" />
            <h1 className="text-xl font-bold text-[#17344F]">{t("signUpTitle")}</h1>
            <p className="text-xs text-[#61768A]">{t("signUpSubtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {t("preferredLanguage")}
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <select
                  value={selectedLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value as "en" | "te" | "hi")}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] focus:ring-1 focus:ring-[#087F72] outline-hidden bg-white cursor-pointer"
                >
                  <option value="en">English</option>
                  <option value="te">తెలుగు (Telugu)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {t("displayName")}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Venkatesh Rao"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] focus:ring-1 focus:ring-[#087F72] outline-hidden transition-all"
                />
              </div>
            </div>

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
                  placeholder="patient@example.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] focus:ring-1 focus:ring-[#087F72] outline-hidden transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {t("password")}
              </label>
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
              <p className="text-[11px] text-gray-500 mt-1">
                {t("passwordRequirements")}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#087F72] hover:bg-[#06665B] text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? common("loading") : t("signUpTitle")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-gray-100 text-center text-xs text-gray-500">
            <span>{t("alreadyHaveAccount")} </span>
            <Link
              href="/auth/sign-in"
              className="font-semibold text-[#087F72] hover:underline ml-1"
            >
              {common("signIn")}
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
