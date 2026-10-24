"use client";

import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";

export function MedicalDisclaimer({ className = "" }: { className?: string }) {
  const t = useTranslations("common");

  return (
    <div
      role="note"
      aria-label="Medical Disclaimer"
      className={`flex items-start gap-3 p-3.5 rounded-xl border border-[#D4E1EE] bg-[#EDF3F7] text-[#08193C] text-xs sm:text-sm leading-relaxed shadow-2xs ${className}`}
    >
      <AlertCircle className="w-4 h-4 text-[#DDB549] shrink-0 mt-0.5" />
      <p className="font-medium text-[#465978]">{t("disclaimer")}</p>
    </div>
  );
}
