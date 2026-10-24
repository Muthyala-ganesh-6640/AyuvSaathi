import type { UserRole } from "@/lib/db/types";

export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  patient: "/dashboard",
  doctor: "/doctor",
  lab_tech: "/lab",
  pharmacist: "/pharmacy",
};

export const ROLE_NAMES: Record<UserRole, string> = {
  patient: "Patient",
  doctor: "Doctor",
  lab_tech: "Lab Technician",
  pharmacist: "Pharmacist",
};

/**
 * Returns the canonical dashboard path for a given role and locale.
 */
export function getDashboardForRole(role?: UserRole | string, locale: string = "en"): string {
  const normalizedRole = (role as UserRole) || "patient";
  const path = ROLE_DASHBOARDS[normalizedRole] || "/dashboard";
  return `/${locale}${path}`;
}

/**
 * Validates whether a specific role is allowed to access a given pathname.
 */
export function isRouteAllowedForRole(pathname: string, role?: UserRole | string): boolean {
  const normalizedRole: UserRole = (role as UserRole) || "patient";

  // Strip locale prefix (e.g., /en/doctor -> /doctor, /te/dashboard -> /dashboard)
  const segments = pathname.split("/").filter(Boolean);
  const pathWithoutLocale = "/" + (segments[0] && segments[0].length === 2 ? segments.slice(1).join("/") : segments.join("/"));

  // Public and Auth routes are allowed for all
  const publicPrefixes = [
    "/auth",
    "/api",
    "/_next",
    "/favicon.ico",
    "/icon.png",
  ];
  if (publicPrefixes.some((prefix) => pathWithoutLocale === prefix || pathWithoutLocale.startsWith(`${prefix}/`))) {
    return true;
  }

  // Doctor-only routes
  if (pathWithoutLocale === "/doctor" || pathWithoutLocale.startsWith("/doctor/")) {
    return normalizedRole === "doctor";
  }

  // Lab-only routes
  if (pathWithoutLocale === "/lab" || pathWithoutLocale.startsWith("/lab/")) {
    return normalizedRole === "lab_tech";
  }

  // Pharmacy-only routes
  if (pathWithoutLocale === "/pharmacy" || pathWithoutLocale.startsWith("/pharmacy/")) {
    return normalizedRole === "pharmacist";
  }

  // Patient-only routes (personal health records, timeline, prescriptions, reports)
  const patientRoutes = [
    "/dashboard",
    "/reports",
    "/prescriptions",
    "/reminders",
    "/timeline",
    "/assistant",
    "/analytics",
    "/discharge-summary",
    "/doctor-summary",
    "/find-care",
    "/settings",
    "/appointments",
  ];

  if (patientRoutes.some((route) => pathWithoutLocale === route || pathWithoutLocale.startsWith(`${route}/`))) {
    return normalizedRole === "patient";
  }

  return true;
}
