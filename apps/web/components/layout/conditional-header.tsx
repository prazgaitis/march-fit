"use client";

import { usePathname } from "next/navigation";
import { Preloaded } from "convex/react";
import { api } from "@repo/backend";
import { Header } from "./header";

// Pages that use the full-height dashboard layout (no top header)
const DASHBOARD_LAYOUT_PATTERNS = [
  /^\/challenges\/[^/]+\/dashboard$/,
  /^\/challenges\/[^/]+\/notifications$/,
  /^\/challenges\/[^/]+\/leaderboard$/,
  /^\/challenges\/[^/]+\/activity-types$/,
  /^\/challenges\/[^/]+\/users\/[^/]+$/,
  /^\/challenges\/[^/]+\/activities\/[^/]+$/,
  /^\/challenges\/[^/]+\/admin(\/.*)?$/,
  /^\/challenges\/[^/]+\/invite\/[^/]+$/,
];

export function ConditionalHeader({
  preloadedUser,
}: {
  preloadedUser: Preloaded<typeof api.queries.users.current>;
}) {
  const pathname = usePathname();

  // Don't render header on homepage or pages using dashboard layout
  if (pathname === "/") {
    return null;
  }

  // Check if current path matches any dashboard layout pattern
  if (DASHBOARD_LAYOUT_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return null;
  }

  return <Header preloadedUser={preloadedUser} />;
}
