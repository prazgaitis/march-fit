"use client";

import { usePathname } from "next/navigation";
import { Preloaded } from "convex/react";
import { api } from "@repo/backend";
import { Header } from "./header";

// Challenge sub-routes that use dashboard/fullscreen layouts and should hide top header.
const HIDDEN_CHALLENGE_SECTIONS = new Set([
  "dashboard",
  "dashboard-ssr-debug",
  "notifications",
  "leaderboard",
  "activity-types",
  "users",
  "activities",
  "forum",
  "admin",
  "invite",
]);

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

  const segments = pathname.split("/").filter(Boolean);
  const challengeSection =
    segments[0] === "challenges" && segments.length >= 3 ? segments[2] : null;

  // Hide header for configured challenge sections and all of their child routes.
  if (challengeSection && HIDDEN_CHALLENGE_SECTIONS.has(challengeSection)) {
    return null;
  }

  return <Header preloadedUser={preloadedUser} />;
}
