"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, ArrowLeft, KeyRound, Info } from "lucide-react";

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const common = useTranslations("common");

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Reset request failed");
      } else {
        toast.success(data.message || "Reset request processed");
        if (data.developmentToken) {
          setDevToken(data.developmentToken);
          setToken(data.developmentToken);
        }
      }
    } catch {
      toast.error("Network error during reset request.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newPassword) {
      toast.error("Please provide both token and new password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Password reset failed");
      } else {
        toast.success("Password changed successfully! You can now sign in.");
      }
    } catch {
      toast.error("Network error during password confirmation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-md mx-auto w-full py-8">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-[#172B3A]">{t("resetTitle")}</h1>
            <p className="text-sm text-gray-500">{t("resetSubtitle")}</p>
          </div>

          {!devToken ? (
            <form onSubmit={handleRequestToken} className="space-y-4">
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#087F72] hover:bg-[#06665B] text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? common("loading") : t("sendResetLink")}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Development Mode: SMTP email is not configured, so your recovery token is pre-filled below for testing.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Reset Token
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs font-mono rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  {t("newPassword")}
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#087F72] hover:bg-[#06665B] text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? common("loading") : t("confirmReset")}
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-gray-100 text-center">
            <Link
              href="/auth/sign-in"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {common("back")} to {common("signIn")}
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
