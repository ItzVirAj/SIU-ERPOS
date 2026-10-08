"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

// Get the base URL for the client
const getBaseURL = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect: () => {
        if (typeof window !== "undefined") {
          window.location.href = "/sign-in?step=2fa";
        }
      },
    }),
  ],
});

export type Session = typeof authClient.$Infer.Session;

// Export specific methods for easier use
export const { signIn, signUp, signOut, useSession } = authClient;
