import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { SESSION_COOKIE, verifyTokenString } from "./lib/auth/session-verify";
import { getDashboardForRole, isRouteAllowedForRole } from "./lib/auth/roles";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Run next-intl middleware first to resolve locales (e.g. / -> /en)
  const response = intlMiddleware(request);

  // 2. Extract locale and normalized path
  const segments = pathname.split("/").filter(Boolean);
  const locale = routing.locales.includes(segments[0] as any) ? segments[0] : "en";
  const pathWithoutLocale = "/" + (segments[0] && routing.locales.includes(segments[0] as any) ? segments.slice(1).join("/") : segments.join("/"));

  // Check if path is public or asset
  const isAuthPage =
    pathWithoutLocale === "/auth/sign-in" ||
    pathWithoutLocale === "/auth/sign-up" ||
    pathWithoutLocale === "/auth/role-select" ||
    pathWithoutLocale === "/auth/professional" ||
    pathWithoutLocale === "/auth/reset";

  const isPublicRoute =
    isAuthPage ||
    pathWithoutLocale === "/" ||
    pathWithoutLocale.startsWith("/api/") ||
    pathWithoutLocale.startsWith("/_next/") ||
    pathWithoutLocale.includes(".");

  // Read session token
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyTokenString(token) : null;

  // Case A: Unauthenticated user trying to access protected dashboards/modules
  if (!session && !isPublicRoute) {
    const signInUrl = new URL(`/${locale}/auth/sign-in`, request.url);
    signInUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Case B: Authenticated user visiting auth pages (sign-in, role-select) -> redirect to their authorized dashboard
  if (session && isAuthPage && pathWithoutLocale !== "/auth/role-select") {
    const targetDashboard = getDashboardForRole(session.role, locale);
    return NextResponse.redirect(new URL(targetDashboard, request.url));
  }

  // Case C: Authenticated user accessing a protected route -> enforce server-side role-to-dashboard match
  if (session && !isPublicRoute) {
    const allowed = isRouteAllowedForRole(pathname, session.role);
    if (!allowed) {
      // Prevent domain leakage / unauthorized dashboard access:
      // Redirect directly to the user's authoritative dashboard
      const authoritativeDashboard = getDashboardForRole(session.role, locale);
      return NextResponse.redirect(new URL(authoritativeDashboard, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
