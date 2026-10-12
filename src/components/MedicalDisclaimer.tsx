"use client";

import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";

export function MedicalDisclaimer({ className = "" }: { className?: string }) {
  const t = useTranslations("common");

  return (
    <div
      role="note"
      aria-label="Medical Disclaimer"
      className={`flex items-start gap-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-900 text-xs sm:text-sm leading-relaxed ${className}`}
    >
      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
      <p>{t("disclaimer")}</p>
    </div>
  );
}
