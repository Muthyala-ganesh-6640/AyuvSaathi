"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { toast } from "sonner";
import { User, Lock, Mail, Globe, ArrowRight } from "lucide-react";

export default function SignUpPage() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();

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
                {t("fullName")}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] focus:ring-1 focus:ring-[#087F72] outline-hidden transition-all"
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
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] focus:ring-1 focus:ring-[#087F72] outline-hidden transition-all"
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
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] focus:ring-1 focus:ring-[#087F72] outline-hidden transition-all"
                />
              </div>
            </div>

            {/* Language Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#087F72]" />
                <span>Preferred Language</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleLanguageChange("en")}
                  className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all cursor-pointer ${
                    selectedLanguage === "en"
                      ? "border-[#087F72] bg-[#DDF5F0] text-[#087F72] font-semibold"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("te")}
                  className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all cursor-pointer ${
                    selectedLanguage === "te"
                      ? "border-[#087F72] bg-[#DDF5F0] text-[#087F72] font-semibold"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  తెలుగు (Telugu)
                </button>
              </div>
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

          <div className="pt-1 text-center text-xs">
            <Link
              href="/auth/professional?role=doctor&mode=register"
              className="text-[#17344F] hover:text-[#087F72] font-medium transition-colors"
            >
              Registering as a Doctor? Open Doctor Portal →
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
