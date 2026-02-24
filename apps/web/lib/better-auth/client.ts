"use client";

import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { lastLoginMethodClient } from "better-auth/client/plugins";

export const betterAuthClient = createAuthClient({
  baseURL: "/api/auth",
  plugins: [convexClient(), lastLoginMethodClient()],
  sessionOptions: {
    // Disable automatic refetch on tab focus — on mobile, switching apps or
    // pulling down the notification shade triggers visibilitychange, causing
    // unnecessary /get-session round-trips that temporarily clear auth state.
    refetchOnWindowFocus: false,
  },
});
