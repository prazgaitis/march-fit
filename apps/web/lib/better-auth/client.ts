"use client";

import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { lastLoginMethodClient } from "better-auth/client/plugins";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveAuthBaseUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/auth`;
  }

  const fromEnv =
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL)}/api/auth`
      : undefined) ??
    "http://localhost:3000/api/auth";

  return stripTrailingSlash(fromEnv);
}

export const betterAuthClient = createAuthClient({
  baseURL: resolveAuthBaseUrl(),
  plugins: [convexClient(), lastLoginMethodClient()],
  sessionOptions: {
    // Disable automatic refetch on tab focus — on mobile, switching apps or
    // pulling down the notification shade triggers visibilitychange, causing
    // unnecessary /get-session round-trips that temporarily clear auth state.
    refetchOnWindowFocus: false,
  },
});
