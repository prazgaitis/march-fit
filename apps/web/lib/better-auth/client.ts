"use client";

import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

function resolveBaseUrl() {
  // Use the Next.js API route as proxy to avoid cross-origin issues
  // The Next.js handler proxies requests to Convex
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/auth`;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    return `${appUrl.replace(/\/$/, "")}/api/auth`;
  }

  return "http://localhost:3000/api/auth";
}

export const betterAuthClient = createAuthClient({
  baseURL: resolveBaseUrl(),
  fetchOptions: {
    credentials: "include",
  },
  plugins: [convexClient()],
});
