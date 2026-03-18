"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Plus } from "lucide-react";

import { ActivityLogDialogLazy as ActivityLogDialog } from "./activity-log-dialog-lazy";
import { navItems } from "./dashboard-nav";
import { buildMobileNavLayout, type MobileNavItem } from "./mobile-nav-layout";
import { NotificationBadge } from "./notification-badge";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  challengeId: string;
  currentUserId: string;
  challengeStartDate?: string;
}

export function MobileNav({ challengeId, currentUserId, challengeStartDate }: MobileNavProps) {
  const pathname = usePathname();

  const { leftItems, rightItems, overflowItems } = buildMobileNavLayout(navItems);
  const menuActive = overflowItems.some((item) => pathname === item.href(challengeId, currentUserId));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-zinc-950 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5 items-center">
        {leftItems.map((item) => {
          const href = item.href(challengeId, currentUserId);
          const isActive = pathname === href ||
            (item.label === "Home" && pathname.endsWith("/dashboard"));

          return (
            <Link
              key={item.label}
              href={href}
              onClick={(e) => {
                if (item.label === "Home" && isActive) {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent("home-tab-tap"));
                }
              }}
              className={cn(
                "relative flex flex-col items-center gap-1 py-3 transition-colors active:opacity-70",
                isActive
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <div className="relative">
                <item.icon className="h-6 w-6" />
                {item.label === "Notifications" && (
                  <NotificationBadge userId={currentUserId} />
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Center Log Activity Button */}
        <div className="flex items-center justify-center">
          <ActivityLogDialog
            challengeId={challengeId}
            challengeStartDate={challengeStartDate}
            trigger={
              <button className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-transparent text-zinc-100 transition hover:bg-white/10 hover:text-white active:scale-95">
                <Plus className="h-6 w-6" />
              </button>
            }
          />
        </div>

        {rightItems.map((item) => {
          const href = item.href(challengeId, currentUserId);
          const isActive = pathname === href;

          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-3 transition-colors active:opacity-70",
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

        <MoreDrawer
          challengeId={challengeId}
          currentUserId={currentUserId}
          menuActive={menuActive}
          overflowItems={overflowItems}
          pathname={pathname}
        />
      </div>
    </nav>
  );
}

function MoreDrawer({
  challengeId,
  currentUserId,
  menuActive,
  overflowItems,
  pathname,
}: {
  challengeId: string;
  currentUserId: string;
  menuActive: boolean;
  overflowItems: MobileNavItem[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          className={cn(
            "flex flex-col items-center gap-1 py-3 transition-colors w-full active:opacity-70",
            menuActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
          )}
          aria-label="More navigation"
        >
          <Menu className="h-6 w-6" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </DrawerTrigger>
      <DrawerContent className="border-zinc-800 bg-zinc-950">
        <DrawerTitle className="sr-only">Navigation</DrawerTitle>
        <nav className="flex flex-col gap-1 px-4 pb-8 pt-2">
          {overflowItems.map((item) => {
            const href = item.href(challengeId, currentUserId);
            const isActive = pathname === href;

            return (
              <Link
                key={item.label}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-base transition-colors active:bg-zinc-800",
                  isActive
                    ? "bg-zinc-800/50 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
