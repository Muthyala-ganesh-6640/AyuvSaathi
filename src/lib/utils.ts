import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function nowIso() {
  return new Date().toISOString();
}

export function safeFileName(name: string) {
  return name.replace(/[^\w.\-()\s\u0C00-\u0C7F\u0900-\u097F]/g, "_").slice(0, 180);
}

export function formatDate(value: string | Date, locale: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const tag = locale === "te" ? "te-IN" : locale === "hi" ? "hi-IN" : "en-IN";
  return new Intl.DateTimeFormat(tag, { dateStyle: "medium" }).format(date);
}

export function formatDateTime(value: string | Date, locale: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const tag = locale === "te" ? "te-IN" : locale === "hi" ? "hi-IN" : "en-IN";
  return new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function clientIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
