import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { safeRedirect } from "@/lib/utils";

import {
  AUTH_COOKIE_PREFIX,
  SESSION_COOKIE_NAME_DEV,
  SESSION_COOKIE_NAME_PROD,
  FALLBACK_COOKIE_NAME_DEV,
  FALLBACK_COOKIE_NAME_PROD,
} from "@/lib/auth-constants";

/**
 * Note: This cookie check in Edge middleware is an optimistic gate for fast navigation and early filtering.
 * Full cryptographic session validation, team tenancy verification, and RBAC authorization are strictly
 * enforced in route handlers and server components via `requireSession()` and `requireTeamMember()`.
 */

function hasSessionCookie(request: NextRequest): boolean {
  try {
    const cookie =
      getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX }) ||
      getSessionCookie(request);
    if (cookie) return true;
  } catch {}

  const cookies = request.cookies;
  return (
    cookies.has(SESSION_COOKIE_NAME_DEV) ||
    cookies.has(SESSION_COOKIE_NAME_PROD) ||
    cookies.has(FALLBACK_COOKIE_NAME_DEV) ||
    cookies.has(FALLBACK_COOKIE_NAME_PROD)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bypass Better Auth internal authentication handlers
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const hasSession = hasSessionCookie(request);

  // 2. Authenticated users visiting /sign-in or /sign-up are redirected to /dashboard
  if (["/sign-in", "/sign-up"].includes(pathname)) {
    if (hasSession) {
      const redirectParam = request.nextUrl.searchParams.get("redirect");
      const target = safeRedirect(redirectParam, "/dashboard");
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  // 3. Allow public pages
  if (pathname === "/" || pathname.startsWith("/invite")) {
    return NextResponse.next();
  }

  // 4. API routes protection: return JSON 401 for unauthenticated requests
  if (pathname.startsWith("/api")) {
    // Public invitation token inspection: GET /api/invitations/[invitationId]
    const isPublicInvitationStatus =
      request.method === "GET" &&
      pathname.startsWith("/api/invitations/") &&
      !pathname.endsWith("/accept") &&
      !pathname.endsWith("/resend");

    if (isPublicInvitationStatus) {
      return NextResponse.next();
    }

    if (!hasSession) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required" },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // 5. Protected application pages: redirect unauthenticated callers to /sign-in
  if (!hasSession) {
    const safePath = safeRedirect(pathname + request.nextUrl.search, "/dashboard");
    const signInUrl = new URL("/sign-in", request.url);
    if (safePath && safePath !== "/dashboard") {
      signInUrl.searchParams.set("redirect", safePath);
    }
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt, sitemap.xml
     * - Static asset file extensions (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
