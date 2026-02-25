"use client";

import { usePathname } from "next/navigation";
import type { Doc } from "@repo/backend/_generated/dataModel";
import { Header } from "./header";

// Challenge sub-routes that use dashboard/fullscreen layouts and should hide top header.
const HIDDEN_CHALLENGE_SECTIONS = new Set([
  "dashboard",
  "dashboard-ssr-debug",
  "notifications",
  "leaderboard",
  "activity-types",
  "settings",
  "users",
  "activities",
  "forum",
  "admin",
  "invite",
]);

export function ConditionalHeader({
  user,
}: {
  user: Doc<"users"> | null;
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

  return <Header user={user} />;
}
