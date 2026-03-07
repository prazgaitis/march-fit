"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const BUILT_VERSION = parseInt(
  process.env.NEXT_PUBLIC_BUNDLE_VERSION || "0",
  10
);

/**
 * Subscribes to the server's bundle version via Convex real-time.
 * When the server version exceeds the version baked into this build,
 * shows a toast prompting the user to refresh.
 */
export function BundleVersionGuard() {
  const serverVersion = useQuery(api.queries.appConfig.getBundleVersion);
  const hasPrompted = useRef(false);

  useEffect(() => {
    // Skip if we don't have a baked version (local dev, first deploy)
    if (BUILT_VERSION === 0) return;
    // Skip until the query loads
    if (serverVersion === undefined) return;
    // Only prompt once per session
    if (hasPrompted.current) return;
    // Only prompt if server is ahead of this build
    if (serverVersion <= BUILT_VERSION) return;

    hasPrompted.current = true;

    toast("A new version is available", {
      description: "Refresh to get the latest updates.",
      duration: Infinity,
      action: {
        label: "Refresh",
        onClick: () => window.location.reload(),
      },
    });
  }, [serverVersion]);

  return null;
}
