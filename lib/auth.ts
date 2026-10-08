import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { db } from "./db";
import { sendVerificationEmail, sendResetPasswordEmail } from "./email";
import { createAuditLog } from "./audit";

// 1. Fail fast at startup if BETTER_AUTH_SECRET is missing or shorter than 32 chars
const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
if (!betterAuthSecret || betterAuthSecret.length < 32) {
  throw new Error("FATAL: BETTER_AUTH_SECRET environment variable is missing or shorter than 32 characters.");
}

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  secret: betterAuthSecret,

  // 2. Email and Password Configuration
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 3600, // 1 hour
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url, token }) => {
      await sendResetPasswordEmail({
        email: user.email,
        url,
        token,
      });
      await createAuditLog({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        action: "SECURITY",
        entityType: "password_reset",
        entityTitle: "Password reset requested",
      });
    },
  },

  emailVerification: {
    expiresIn: 3600, // 1 hour
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      await sendVerificationEmail({
        email: user.email,
        url,
        token,
      });
    },
  },

  // 3. Database-backed Rate Limiting
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    window: 60, // 1 minute default
    max: 100,
    customRules: {
      "/sign-in/email": {
        window: 600, // 10 minutes
        max: 5,
      },
      "/sign-up/email": {
        window: 600, // 10 minutes
        max: 5,
      },
      "/forget-password": {
        window: 600, // 10 minutes
        max: 5,
      },
      "/reset-password": {
        window: 600, // 10 minutes
        max: 5,
      },
    },
  },

  // 4. Session Configuration & Secure Cookies
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes max
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookiePrefix: "siu",
  },

  // 5. Trusted Origins (built dynamically without hardcoded IPs or domains)
  trustedOrigins: async () => {
    const origins: string[] = [];
    if (process.env.BETTER_AUTH_URL) {
      try {
        origins.push(new URL(process.env.BETTER_AUTH_URL).origin);
      } catch {}
    }
    if (process.env.NEXT_PUBLIC_APP_URL) {
      try {
        origins.push(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
      } catch {}
    }
    if (process.env.NODE_ENV !== "production") {
      origins.push("http://localhost:3000", "http://127.0.0.1:3000");
    }
    return Array.from(new Set(origins));
  },

  // 6. Account Linking
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  // Social OAuth providers (Google only; GitHub removed unless explicitly configured)
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },

  // 8. Audit Logging via Database Hooks
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await createAuditLog({
            userId: session.userId,
            action: "LOGIN",
            entityType: "session",
            entityId: session.id,
            entityTitle: "User signed in successfully",
            ipAddress: session.ipAddress,
            details: { userAgent: session.userAgent },
          });
        },
      },
      delete: {
        after: async (session) => {
          await createAuditLog({
            userId: session.userId,
            action: "SECURITY",
            entityType: "session",
            entityId: session.id,
            entityTitle: "Session revoked",
            ipAddress: session.ipAddress,
          });
        },
      },
    },
    user: {
      create: {
        after: async (user) => {
          await createAuditLog({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            action: "CREATE",
            entityType: "user",
            entityId: user.id,
            entityTitle: `New user account registered (${user.email})`,
          });
        },
      },
    },
  },

  // 7. Plugins: twoFactor and nextCookies
  plugins: [
    twoFactor({
      issuer: "SIU-ERPOS",
    }),
    nextCookies(), // Must be last plugin
  ],
});

export type Session = typeof auth.$Infer.Session;

// Session helpers for server-side
export async function getAuthUser() {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((m) => m.headers()),
  });
  return session?.user?.id;
}

export async function requireAuth() {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((m) => m.headers()),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return session.user.id;
}

export async function currentUser() {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((m) => m.headers()),
  });
  return session?.user || null;
}

// For backwards compatibility with existing code
export async function getAuthHeaders() {
  return {};
}
