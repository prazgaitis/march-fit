"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ReactNode, useMemo } from "react";

import { betterAuthClient } from "@/lib/better-auth/client";

let convexClientSingleton: ConvexReactClient | null = null;

function resolveConvexClientUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!configuredUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  }

  if (typeof window === "undefined") {
    return configuredUrl;
  }

  try {
    const parsed = new URL(configuredUrl);
    const isLoopbackHost =
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "::1";

    if (isLoopbackHost) {
      const runtimeHost = window.location.hostname;
      if (runtimeHost && runtimeHost !== parsed.hostname) {
        parsed.hostname = runtimeHost;
        return parsed.toString();
      }
    }
  } catch {
    // Fall back to configured URL when parsing fails.
  }

  return configuredUrl;
}

function getConvexClient() {
  if (!convexClientSingleton) {
    convexClientSingleton = new ConvexReactClient(resolveConvexClientUrl());
  }
  return convexClientSingleton;
}

export function ConvexProviderWrapper({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  const convex = useMemo(() => getConvexClient(), []);

  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={betterAuthClient}
      initialToken={initialToken}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
