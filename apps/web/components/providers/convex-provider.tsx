"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import * as Sentry from "@sentry/nextjs";
import { ReactNode, useMemo } from "react";
import { useAuth as useClerkAuth } from "@clerk/nextjs";

let convexClientSingleton: ConvexReactClient | null = null;

function isConvexDebugEnabled() {
  const value = process.env.NEXT_PUBLIC_CONVEX_DEBUG;
  return value === "1" || value === "true";
}

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
        return parsed.toString().replace(/\/$/, "");
      }
    }
  } catch {
    // Fall back to configured URL when parsing fails.
  }

  return configuredUrl;
}

function getConvexClient() {
  if (!convexClientSingleton) {
    const debugEnabled = isConvexDebugEnabled();
    convexClientSingleton = new ConvexReactClient(resolveConvexClientUrl(), {
      verbose: debugEnabled,
      reportDebugInfoToConvex: debugEnabled,
      onServerDisconnectError: (message) => {
        if (!debugEnabled) {
          return;
        }

        console.warn("[convex][disconnect]", message);
        Sentry.captureMessage("Convex server disconnect", {
          level: "warning",
          tags: {
            area: "convex-client",
            source: "onServerDisconnectError",
          },
          extra: {
            message,
          },
        });
      },
    });

    if (debugEnabled) {
      console.info("[convex][debug] client initialized", {
        url: convexClientSingleton.url,
      });
    }
  }
  return convexClientSingleton;
}

export function ConvexProviderWrapper({
  children,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  const convex = useMemo(() => getConvexClient(), []);
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
