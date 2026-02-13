import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Derive NEXT_PUBLIC_CONVEX_SITE_URL from NEXT_PUBLIC_CONVEX_URL if not set.
// The site URL is always the cloud URL with ".convex.cloud" → ".convex.site".
if (!process.env.NEXT_PUBLIC_CONVEX_SITE_URL && process.env.NEXT_PUBLIC_CONVEX_URL) {
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_URL.replace(
    ".convex.cloud",
    ".convex.site"
  );
}

const nextConfig: NextConfig = {};

const sentryConfig = withSentryConfig(nextConfig, {
  tunnelRoute: "/monitoring",
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeTracing: false,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: false,
  },
});

export default process.env.NODE_ENV === "production" ? sentryConfig : nextConfig;
