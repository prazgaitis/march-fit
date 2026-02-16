"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import { ActivityLogDialogLazy as ActivityLogDialog } from "./activity-log-dialog-lazy";
import { navItems } from "./dashboard-nav";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  challengeId: string;
  currentUserId: string;
  challengeStartDate?: string;
}

export function MobileNav({ challengeId, currentUserId, challengeStartDate }: MobileNavProps) {
  const pathname = usePathname();
  const [isDimmed, setIsDimmed] = useState(false);
  const lastScrollY = useRef(0);
  const isTicking = useRef(false);

  useEffect(() => {
    const fadeThresholdPx = 12;
    const minScrollBeforeFadePx = 56;

    const handleScroll = () => {
      if (isTicking.current) {
        return;
      }

      isTicking.current = true;
      requestAnimationFrame(() => {
        const nextScrollY = window.scrollY;
        const delta = nextScrollY - lastScrollY.current;

        if (Math.abs(delta) >= fadeThresholdPx) {
          if (delta > 0 && nextScrollY > minScrollBeforeFadePx) {
            setIsDimmed(true);
          } else if (delta < 0 || nextScrollY <= 0) {
            setIsDimmed(false);
          }
        }

        if (nextScrollY <= 0) {
          setIsDimmed(false);
        }

        lastScrollY.current = nextScrollY;
        isTicking.current = false;
      });
    };

    lastScrollY.current = window.scrollY;
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    setIsDimmed(false);
    lastScrollY.current = window.scrollY;
  }, [pathname]);

  // Take first 4 items for mobile (Home, Notifications, Leaderboard, Profile)
  // Skip Activity Types to make room for the + button
  const mobileItems = [
    navItems[0], // Home
    navItems[1], // Notifications
    navItems[2], // Leaderboard
    navItems[4], // Profile
  ];

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 transition-all duration-300 lg:hidden",
        isDimmed
          ? "border-t border-white/5 bg-zinc-950/35 opacity-45"
          : "border-t border-white/10 bg-zinc-950/60 opacity-100 shadow-[0_-8px_24px_rgba(0,0,0,0.3)]"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
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
          challengeStartDate={challengeStartDate}
          trigger={
            <button className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-transparent text-zinc-100 transition hover:bg-white/10 hover:text-white">
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
