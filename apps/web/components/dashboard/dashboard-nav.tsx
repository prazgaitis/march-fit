"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Bell,
  Trophy,
  Zap,
  User,
} from "lucide-react";

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

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
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
            <item.icon className={cn("h-6 w-6 flex-shrink-0", isActive && "text-white")} />
            {!collapsed && <span className="text-lg font-medium">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
