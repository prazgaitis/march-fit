"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import { ActivityLogDialog } from "./activity-log-dialog";
import { navItems } from "./dashboard-nav";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  challengeId: string;
  currentUserId: string;
}

export function MobileNav({ challengeId, currentUserId }: MobileNavProps) {
  const pathname = usePathname();

  // Take first 4 items for mobile (Home, Notifications, Leaderboard, Profile)
  // Skip Activity Types to make room for the + button
  const mobileItems = [
    navItems[0], // Home
    navItems[1], // Notifications
    navItems[2], // Leaderboard
    navItems[4], // Profile
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/80 lg:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {mobileItems.slice(0, 2).map((item) => {
          const href = item.href(challengeId, currentUserId);
          const isActive = pathname === href ||
            (item.label === "Home" && pathname.endsWith("/dashboard"));

          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-4 py-2 transition-colors",
                isActive
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Center Log Activity Button */}
        <ActivityLogDialog
          challengeId={challengeId}
          trigger={
            <button className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-500">
              <Plus className="h-6 w-6" />
            </button>
          }
        />

        {mobileItems.slice(2).map((item) => {
          const href = item.href(challengeId, currentUserId);
          const isActive = pathname === href;

          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-4 py-2 transition-colors",
                isActive
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
