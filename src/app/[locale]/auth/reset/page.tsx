"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Mail,
  ArrowLeft,
  KeyRound,
  Info,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Send,
  Lock,
} from "lucide-react";

function ResetPasswordContent() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode: "request" (Step 1) or "confirm" (Step 2)
  const [activeTab, setActiveTab] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Results from Step 1
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Read URL query params on load (e.g. from email link ?token=...&email=...)
  useEffect(() => {
    const urlToken = searchParams.get("token");
    const urlEmail = searchParams.get("email");
    if (urlToken) {
      setToken(urlToken);
      setActiveTab("confirm");
      toast.info("Recovery token loaded from URL. Enter your new password below.");
    }
    if (urlEmail) {
      setEmail(urlEmail);
    }
  }, [searchParams]);

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your registered email address.");
      return;
    }

    setLoading(true);
    setDevToken(null);
    setEmailSent(null);
    setResetUrl(null);

    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Reset request failed. Please verify the email.");
      } else {
        toast.success(data.message || "Reset request processed");
        setEmailSent(Boolean(data.emailSent));

        if (data.developmentToken) {
          setDevToken(data.developmentToken);
          setToken(data.developmentToken);
        }
        if (data.resetUrl) {
          setResetUrl(data.resetUrl);
        }
      }
    } catch {
      toast.error("Network error during reset request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newPassword) {
      toast.error("Please provide both the recovery token and your new password.");
      return;
    }

    if (newPassword.length < 10) {
      toast.error("Password must be at least 10 characters long.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim(), password: newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Password reset failed. Token may be invalid or expired.");
      } else {
        setResetSuccess(true);
        toast.success(data.message || "Password changed successfully! Redirecting...");
        setTimeout(() => {
          router.push("/auth/sign-in");
        }, 2200);
      }
    } catch {
      toast.error("Network error during password confirmation.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (!devToken) return;
    navigator.clipboard.writeText(devToken);
    setCopied(true);
    toast.success("Recovery token copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseTokenNow = () => {
    if (devToken) {
      setToken(devToken);
    }
    setActiveTab("confirm");
  };

  return (
    <div className="max-w-lg mx-auto w-full py-8 px-4">
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6">
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 bg-[#087F8C]/10 text-[#087F8C] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-[#172B3A]">{t("resetTitle")}</h1>
          <p className="text-sm text-gray-500">{t("resetSubtitle")}</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("request")}
            className={`flex-1 py-2 px-3 rounded-lg transition-all ${
              activeTab === "request"
                ? "bg-white text-[#172B3A] shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            1. Request Reset Link
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("confirm")}
            className={`flex-1 py-2 px-3 rounded-lg transition-all ${
              activeTab === "confirm"
                ? "bg-white text-[#172B3A] shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            2. Enter Recovery Token
          </button>
        </div>

        {/* Success Screen */}
        {resetSuccess ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h3 className="text-base font-bold text-emerald-900">Password Reset Completed</h3>
            <p className="text-xs text-emerald-700">
              Your password has been securely updated. You can now log in to your AyuvSaathi account with your new credentials.
            </p>
            <Link
              href="/auth/sign-in"
              className="inline-block mt-3 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Go to Sign In
            </Link>
          </div>
        ) : activeTab === "request" ? (
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
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-300 focus:border-[#087F8C] focus:ring-1 focus:ring-[#087F8C] outline-hidden transition-all"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Enter the email associated with your AyuvSaathi patient profile.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-[#087F8C] hover:bg-[#06665B] text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>{common("loading")}</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{t("sendResetLink")}</span>
                </>
              )}
            </button>

            {/* Email Sent Confirmation */}
            {emailSent === true && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-950">Reset Email Dispatched</p>
                  <p className="mt-0.5 text-emerald-800">
                    A recovery link has been delivered to <strong>{email}</strong>. Check your inbox and spam folder, then click the link to proceed.
                  </p>
                </div>
              </div>
            )}

            {/* Development / Local Token Fallback Card */}
            {devToken && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900">
                      {emailSent ? "Local Token Copy" : "Recovery Token (Active & Ready)"}
                    </p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      {emailSent
                        ? "SMTP delivered your email. You can also test with this token directly:"
                        : "SMTP email is unconfigured or simulated. Use the token below to set your new password:"}
                    </p>
                  </div>
                </div>

                <div className="relative bg-white border border-amber-200 rounded-lg p-2.5 font-mono text-[11px] text-gray-800 break-all select-all">
                  {devToken}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="w-full sm:w-auto flex-1 py-2 px-3 bg-white border border-amber-300 hover:bg-amber-100/50 text-amber-900 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy Token"}</span>
                  </button>

                  {resetUrl && (
                    <a
                      href={resetUrl}
                      className="w-full sm:w-auto py-2 px-3 bg-white border border-amber-300 hover:bg-amber-100/50 text-amber-900 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Open Reset Link</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={handleUseTokenNow}
                    className="w-full sm:w-auto flex-1 py-2 px-3 bg-[#087F8C] hover:bg-[#06665B] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Use Token Now</span>
                  </button>
                </div>
              </div>
            )}
          </form>
        ) : (
          /* Confirm Step (Tab 2) */
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Recovery Token
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <textarea
                  rows={3}
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your signed reset token here"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl border border-gray-300 focus:border-[#087F8C] focus:ring-1 focus:ring-[#087F8C] outline-hidden bg-gray-50/50"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Enter the security token received via email or generated in Step 1.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {t("newPassword")}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-gray-300 focus:border-[#087F8C] focus:ring-1 focus:ring-[#087F8C] outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Must be at least 10 characters with uppercase, lowercase, and a number.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-[#087F8C] hover:bg-[#06665B] text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>{common("loading")}</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t("confirmReset")}</span>
                </>
              )}
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-gray-100 text-center">
          <Link
            href="/auth/sign-in"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {common("back")} to {common("signIn")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="max-w-lg mx-auto py-12 text-center text-sm text-gray-500">Loading recovery options...</div>}>
        <ResetPasswordContent />
      </Suspense>
    </AppShell>
  );
}
