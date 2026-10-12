"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Globe } from "lucide-react";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (newLocale: "en" | "te" | "hi") => {
    if (newLocale === currentLocale) return;
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className={`flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-1 text-xs font-medium shadow-xs ${className}`}>
      <Globe className="w-3.5 h-3.5 text-gray-400 ml-1" />
      <button
        type="button"
        onClick={() => handleLanguageChange("en")}
        className={`px-2 py-1 rounded transition-colors ${
          currentLocale === "en"
            ? "bg-[#087F72] text-white font-semibold"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        }`}
        aria-label="Switch to English"
      >
        English
      </button>
      <button
        type="button"
        onClick={() => handleLanguageChange("te")}
        className={`px-2 py-1 rounded transition-colors ${
          currentLocale === "te"
            ? "bg-[#087F72] text-white font-semibold"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        }`}
        aria-label="Switch to Telugu"
      >
        తెలుగు
      </button>
      <button
        type="button"
        onClick={() => handleLanguageChange("hi")}
        className={`px-2 py-1 rounded transition-colors ${
          currentLocale === "hi"
            ? "bg-[#087F72] text-white font-semibold"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        }`}
        aria-label="Switch to Hindi"
      >
        हिन्दी
      </button>
    </div>
  );
}
