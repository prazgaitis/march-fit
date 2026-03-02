"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Bell,
  Trophy,
  Zap,
  User,
  MessageSquare,
  Bug,
} from "lucide-react";

import { NotificationBadge } from "./notification-badge";
import { cn } from "@/lib/utils";

interface DashboardNavProps {
  challengeId: string;
  currentUserId: string;
  collapsed?: boolean;
}

export const navItems = [
  {
    label: "Home",
    icon: Home,
    href: (challengeId: string) => `/challenges/${challengeId}/dashboard`,
  },
  {
    label: "Notifications",
    icon: Bell,
    href: (challengeId: string) => `/challenges/${challengeId}/notifications`,
  },
  {
    label: "Leaderboard",
    icon: Trophy,
    href: (challengeId: string) => `/challenges/${challengeId}/leaderboard`,
  },
  {
    label: "Forum",
    icon: MessageSquare,
    href: (challengeId: string) => `/challenges/${challengeId}/forum`,
  },
  {
    label: "Feedback",
    icon: Bug,
    href: (challengeId: string) => `/challenges/${challengeId}/feedback`,
  },
  {
    label: "Earning Points",
    icon: Zap,
    href: (challengeId: string) => `/challenges/${challengeId}/activity-types`,
  },
  {
    label: "Profile",
    icon: User,
    href: (challengeId: string, userId: string) =>
      `/challenges/${challengeId}/users/${userId}`,
  },
];

export function DashboardNav({ challengeId, currentUserId, collapsed }: DashboardNavProps) {
  const pathname = usePathname();
  const primaryItems = navItems.filter((item) => item.label !== "Feedback");
  const feedbackItem = navItems.find((item) => item.label === "Feedback");
  const feedbackHref = feedbackItem
    ? feedbackItem.href(challengeId, currentUserId)
    : null;
  const feedbackIsActive = feedbackHref ? pathname === feedbackHref : false;

  return (
    <div className="flex flex-col gap-3">
      <nav className="flex flex-col gap-1">
        {primaryItems.map((item) => {
          const href = item.href(challengeId, currentUserId);
          const isActive = pathname === href ||
            (item.label === "Home" && pathname.endsWith("/dashboard"));

          return (
            <Link
              key={item.label}
              href={href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-full transition-colors",
                collapsed
                  ? "justify-center p-3"
                  : "gap-4 px-4 py-3",
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
              )}
            >
              <div className="relative">
                <item.icon className={cn("h-6 w-6 flex-shrink-0", isActive && "text-white")} />
                {item.label === "Notifications" && (
                  <NotificationBadge userId={currentUserId} />
                )}
              </div>
              {!collapsed && <span className="text-lg font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="pt-3">
        {feedbackItem ? (
          <>
            <div className={cn("border-t border-zinc-800", collapsed ? "mx-3" : "mx-1")} />
            <nav className="mt-3 flex flex-col gap-1">
              <Link
                key={feedbackItem.label}
                href={feedbackHref!}
                title={collapsed ? feedbackItem.label : undefined}
                className={cn(
                  "flex items-center rounded-full transition-colors",
                  collapsed
                    ? "justify-center p-3"
                    : "gap-4 px-4 py-3",
                  feedbackIsActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                )}
              >
                <feedbackItem.icon
                  className={cn("h-6 w-6 flex-shrink-0", feedbackIsActive && "text-white")}
                />
                {!collapsed && (
                  <span className="text-lg font-medium">{feedbackItem.label}</span>
                )}
              </Link>
            </nav>
          </>
        ) : null}
      </div>
    </div>
  );
}
