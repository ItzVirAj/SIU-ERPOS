/**
 * Authoritative shared authentication & session cookie constants.
 * Imported by both lib/auth.ts (Node/server) and middleware.ts (Edge runtime).
 */

export const AUTH_COOKIE_PREFIX = "siu";

// Exact session cookie names issued in development and production modes:
export const SESSION_COOKIE_NAME_DEV = `${AUTH_COOKIE_PREFIX}.session_token`;
export const SESSION_COOKIE_NAME_PROD = `__Secure-${AUTH_COOKIE_PREFIX}.session_token`;

// Also export the fallback names for Better Auth defaults
export const FALLBACK_COOKIE_NAME_DEV = "better-auth.session_token";
export const FALLBACK_COOKIE_NAME_PROD = "__Secure-better-auth.session_token";
