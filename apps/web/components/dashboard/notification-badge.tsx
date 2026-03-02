"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

interface NotificationBadgeProps {
  userId: string;
}

/**
 * Real-time unread notification count badge.
 * Uses Convex live query so it updates automatically when notifications change.
 */
export function NotificationBadge({ userId }: NotificationBadgeProps) {
  const count = useQuery(api.queries.notifications.getUnreadCount, {
    userId: userId as Id<"users">,
  });

  if (!count) return null;

  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
