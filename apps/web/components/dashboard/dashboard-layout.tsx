"use client";

import { ReactNode } from "react";
import { Plus } from "lucide-react";
import type { Doc } from "@repo/backend/_generated/dataModel";
import { formatDateShortFromDateOnly } from "@/lib/date-only";

import { ActivityLogDialogLazy as ActivityLogDialog } from "./activity-log-dialog-lazy";
import { AnnouncementBanner } from "./announcement-banner";
import { PaymentRequiredBanner } from "./payment-required-banner";
import { DashboardNav } from "./dashboard-nav";
import { DashboardUserMenu } from "./dashboard-user-menu";
import { UserSearch } from "./user-search";
import { ChallengeSidebar } from "./challenge-sidebar";
import { MobileNav } from "./mobile-nav";

interface DashboardLayoutProps {
  challenge: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  currentUserId: string;
  currentUser: Doc<"users">;
  children: ReactNode;
  hideRightSidebar?: boolean;
}

export function DashboardLayout({
  challenge,
  currentUserId,
  currentUser,
  children,
  hideRightSidebar = false,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-dvh overflow-hidden bg-black text-white">
      {/* Left Sidebar - Collapsed (lg) */}
      <aside className="hidden w-[72px] flex-shrink-0 flex-col border-r border-zinc-800 lg:flex xl:hidden">
        <div className="flex h-full flex-col items-center py-4">
          {/* Logo/Icon */}
          <div className="mb-4 h-10 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" />

          {/* Navigation */}
          <div className="flex-1">
            {/* Log Activity Button */}
            <div className="mb-1">
              <ActivityLogDialog
                challengeId={challenge.id}
                challengeStartDate={challenge.startDate}
                trigger={
                  <button
                    className="flex items-center justify-center rounded-full p-3 text-indigo-400 transition-colors hover:bg-zinc-900 hover:text-indigo-300"
                    title="Log activity"
                  >
                    <Plus className="h-6 w-6" />
                  </button>
                }
              />
            </div>

            <DashboardNav
              challengeId={challenge.id}
              currentUserId={currentUserId}
              collapsed
            />
          </div>

          {/* User Menu - Bottom */}
          <div className="border-t border-zinc-800 pt-4">
            <DashboardUserMenu
              challengeId={challenge.id}
              currentUserId={currentUserId}
              currentUser={currentUser}
              collapsed
            />
          </div>
        </div>
      </aside>

      {/* Left Sidebar - Full (xl) */}
      <aside className="hidden w-72 flex-shrink-0 flex-col border-r border-zinc-800 xl:flex">
        <div className="flex h-full flex-col">
          {/* Challenge Header */}
          <div className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-400">
              Challenge
            </p>
            <h1 className="mt-1 text-lg font-bold text-white">{challenge.name}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateShortFromDateOnly(challenge.startDate)} –{" "}
              {formatDateShortFromDateOnly(challenge.endDate)}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex-1 px-2">
            {/* Log Activity Button */}
            <div className="mb-1">
              <ActivityLogDialog
                challengeId={challenge.id}
                challengeStartDate={challenge.startDate}
                trigger={
                  <button className="flex w-full items-center gap-4 rounded-full px-4 py-3 text-indigo-400 transition-colors hover:bg-zinc-900 hover:text-indigo-300">
                    <Plus className="h-6 w-6 flex-shrink-0" />
                    <span className="text-lg font-medium">Log activity</span>
                  </button>
                }
              />
            </div>

            <DashboardNav challengeId={challenge.id} currentUserId={currentUserId} />
          </div>

          {/* User Menu - Bottom */}
          <div className="border-t border-zinc-800 p-4">
            <DashboardUserMenu
              challengeId={challenge.id}
              currentUserId={currentUserId}
              currentUser={currentUser}
            />
          </div>
        </div>
      </aside>

      {/* Main Content - Scrollable */}
      <main className="min-h-0 flex-1 overflow-y-auto scrollbar-hide pb-20 lg:pb-0">
        <PaymentRequiredBanner challengeId={challenge.id} />
        <AnnouncementBanner challengeId={challenge.id} />
        {children}
      </main>

      {/* Right Sidebar - Fixed (xl only) */}
      {!hideRightSidebar && (
        <aside className="hidden min-h-0 w-96 flex-shrink-0 flex-col border-l border-zinc-800 xl:flex">
          <div className="p-4">
            <UserSearch challengeId={challenge.id} />
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
            <ChallengeSidebar challengeId={challenge.id} currentUserId={currentUserId} />
          </div>
        </aside>
      )}

      {/* Mobile Bottom Nav */}
      <MobileNav challengeId={challenge.id} currentUserId={currentUserId} challengeStartDate={challenge.startDate} />
    </div>
  );
}
