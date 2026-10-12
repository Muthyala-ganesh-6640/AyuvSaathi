"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";

import { useTranslations } from "next-intl";

interface BrandLogoProps {
  variant?: "header" | "full" | "sidebar" | "auth" | "emblem-only";
  className?: string;
  showTagline?: boolean;
  href?: string;
}

export function BrandLogo({
  variant = "header",
  className = "",
  showTagline = true,
  href = "/dashboard",
}: BrandLogoProps) {
  const t = useTranslations("common");

  const content = (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Official AyuvSaathi Emblem / Robot Heart */}
      <div className="relative shrink-0 overflow-hidden rounded-xl bg-white border border-[#E1EBF0] shadow-xs flex items-center justify-center p-0.5">
        <Image
          src="/brand/ayuvsaathi-emblem.png"
          alt="AyuvSaathi Healthcare Companion"
          width={variant === "auth" ? 56 : variant === "full" ? 48 : 38}
          height={variant === "auth" ? 56 : variant === "full" ? 48 : 38}
          className="object-contain"
          priority
        />
      </div>

      {variant !== "emblem-only" && (
        <div className="flex flex-col leading-none">
          <div className="flex items-baseline">
            <span
              className={`font-black tracking-tight text-[#17466B] ${
                variant === "auth"
                  ? "text-2xl"
                  : variant === "full"
                  ? "text-xl"
                  : "text-lg"
              }`}
            >
              Ayuv
            </span>
            <span
              className={`font-black tracking-tight text-[#087F8C] ${
                variant === "auth"
                  ? "text-2xl"
                  : variant === "full"
                  ? "text-xl"
                  : "text-lg"
              }`}
            >
              Saathi
            </span>
          </div>
          {showTagline && (
            <span
              className={`text-[#61768A] font-medium tracking-tight mt-0.5 ${
                variant === "auth" ? "text-xs" : "text-[10px]"
              }`}
            >
              {t("tagline")}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex hover:opacity-95 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
