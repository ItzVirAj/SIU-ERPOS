import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validates and sanitizes a redirect target to prevent open redirect vulnerabilities.
 * Only permits same-origin relative paths starting with a single '/' and rejects
 * protocol-relative URLs ('//'), backslashes, and arbitrary URI schemes.
 */
export function safeRedirect(
  path: string | null | undefined,
  defaultPath: string = "/dashboard"
): string {
  if (!path || typeof path !== "string") {
    return defaultPath
  }

  const trimmed = path.trim()

  // Must begin with a single '/' and must not contain backslashes or protocol-relative slashes
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\\")
  ) {
    return defaultPath
  }

  try {
    const dummyOrigin = "http://localhost"
    const parsed = new URL(trimmed, dummyOrigin)

    // Ensure the host/origin was not redirected to an external domain
    if (parsed.origin !== dummyOrigin) {
      return defaultPath
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return defaultPath
  }
}

