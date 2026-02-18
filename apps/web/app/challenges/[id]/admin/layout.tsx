import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getConvexClient } from "@/lib/convex-server";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { dateOnlyToUtcMs, formatDateShortFromDateOnly } from "@/lib/date-only";
import { ArrowLeft } from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { AdminNavigation, type AdminNavigationGroup } from "@/components/admin/admin-navigation";
import { fetchAuthQuery } from "@/lib/server-auth";

interface ChallengeAdminLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ChallengeAdminLayout({
  children,
  params,
}: ChallengeAdminLayoutProps) {
  const convex = getConvexClient();
  const { id } = await params;
  const user = await requireAuth();

  const challenge = await convex.query(api.queries.challenges.getById, {
    challengeId: id as Id<"challenges">,
  });

  if (!challenge) {
    notFound();
  }

  // Check if user can manage this challenge
  const adminStatus = await fetchAuthQuery<{ isAdmin: boolean; reason: "global_admin" | "creator" | "challenge_admin" | null }>(api.queries.participations.isUserChallengeAdmin, {
    challengeId: id as Id<"challenges">,
  });

  if (!adminStatus.isAdmin) {
    redirect(`/challenges/${challenge._id}`);
  }

  const participantCount = await convex.query(api.queries.participations.getCount, {
    challengeId: id as Id<"challenges">,
  });

  const base = `/challenges/${challenge._id}/admin`;

  const navGroups: AdminNavigationGroup[] = [
    {
      label: "Monitor",
      items: [
        { href: base, label: "Overview", segment: "(overview)" },
        { href: `${base}/flagged-activities`, label: "Flagged", segment: "flagged-activities" },
      ],
    },
    {
      label: "Scoring",
      items: [
        { href: `${base}/activity-types`, label: "Activity Types", segment: "activity-types" },
        { href: `${base}/integrations`, label: "Integrations", segment: "integrations" },
        { href: `${base}/achievements`, label: "Achievements", segment: "achievements" },
      ],
    },
    {
      label: "Engage",
      items: [
        { href: `${base}/forum`, label: "Forum", segment: "forum" },
        { href: `${base}/mini-games`, label: "Mini Games", segment: "mini-games" },
        { href: `${base}/emails`, label: "Emails", segment: "emails" },
        { href: `${base}/email-sends`, label: "Send Log", segment: "email-sends" },
      ],
    },
    {
      label: "People",
      items: [
        { href: `${base}/participants`, label: "Participants", segment: "participants" },
        { href: `${base}/payments`, label: "Payments", segment: "payments" },
      ],
    },
    {
      label: "Configure",
      items: [
        { href: `${base}/settings`, label: "Settings", segment: "settings" },
      ],
    },
  ];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Dense Header Bar */}
      <header className="flex-shrink-0 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between px-3 py-2">
          {/* Left: Back + Challenge Name */}
          <div className="flex items-center gap-3">
            <Link
              href={`/challenges/${challenge._id}/dashboard`}
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Dashboard</span>
            </Link>
            <div className="h-4 w-px bg-zinc-700" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-amber-500">
                ADMIN
              </span>
              <span className="text-sm font-semibold text-white">
                {challenge.name}
              </span>
            </div>
          </div>

          {/* Right: Quick Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">Participants</span>
              <span className="font-mono font-medium text-emerald-400">
                {participantCount}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">Period</span>
              <span className="font-mono text-zinc-300">
                {formatDateShortFromDateOnly(challenge.startDate)} - {formatDateShortFromDateOnly(challenge.endDate)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">Status</span>
              {Date.now() >= dateOnlyToUtcMs(challenge.startDate) && Date.now() <= dateOnlyToUtcMs(challenge.endDate) ? (
                <span className="font-mono font-medium text-emerald-400">ACTIVE</span>
              ) : Date.now() < dateOnlyToUtcMs(challenge.startDate) ? (
                <span className="font-mono font-medium text-amber-400">PENDING</span>
              ) : (
                <span className="font-mono font-medium text-zinc-500">ENDED</span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-t border-zinc-800/50 px-3">
          <AdminNavigation groups={navGroups} />
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-3">
          {children}
        </div>
      </main>

      {/* Status Bar */}
      <footer className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900 px-3 py-1">
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>Challenge ID: {challenge._id}</span>
          <span>Admin: {user.email}</span>
        </div>
      </footer>
    </div>
  );
}
