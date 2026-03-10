"use client";

import { Users } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { formatPointsCompact } from "@/lib/points";
import { cn } from "@/lib/utils";

interface PartnerWeekCardProps {
  gameName: string;
  endsAt: number;
  challengeId: string;
  partner: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  } | null;
  partnerRank?: number;
  partnerPeriodPoints: number;
  bonusPercentage?: number;
  /** "compact" for sidebar, "feed" for inline feed injection */
  variant?: "compact" | "feed";
}

export function PartnerWeekCard({
  gameName,
  endsAt,
  challengeId,
  partner,
  partnerRank,
  partnerPeriodPoints,
  bonusPercentage = 10,
  variant = "compact",
}: PartnerWeekCardProps) {
  const potentialBonus = Math.round(partnerPeriodPoints * (bonusPercentage / 100));

  const daysLeft = Math.max(
    0,
    Math.ceil((endsAt - Date.now()) / (1000 * 60 * 60 * 24))
  );

  const isFeed = variant === "feed";

  return (
    <div className={cn(
      "rounded-lg border border-zinc-800",
      isFeed ? "p-4" : "p-3",
    )}>
      {/* Header row: game name + days left + bonus */}
      <div className={cn("flex items-center justify-between", isFeed ? "mb-4" : "mb-3")}>
        <div className="flex items-center gap-1.5">
          <Users className={cn(isFeed ? "h-4 w-4" : "h-3.5 w-3.5", "text-indigo-400")} />
          <span className={cn(
            "font-medium uppercase tracking-widest text-zinc-500",
            isFeed ? "text-xs" : "text-xs",
          )}>
            {gameName}
          </span>
          <span className="text-xs text-zinc-700">·</span>
          <span className="text-xs text-zinc-600">
            {daysLeft}d left
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn(
            "font-mono font-bold text-emerald-400",
            isFeed ? "text-2xl" : "text-xl",
          )}>
            +{formatPointsCompact(potentialBonus)}
          </span>
          <span className={cn(isFeed ? "text-xs" : "text-[10px]", "text-zinc-600")}>bonus</span>
        </div>
      </div>

      {/* Partner row */}
      {partner && (
        <div className="flex items-center justify-between">
          <UserAvatar
            user={partner}
            challengeId={challengeId}
            size={isFeed ? "lg" : "md"}
            showName
            showUsername
          >
            <p className={cn(isFeed ? "text-xs" : "text-[10px]", "text-zinc-600")}>
              #{partnerRank ?? "?"} · {formatPointsCompact(partnerPeriodPoints)} pts this week
            </p>
          </UserAvatar>
        </div>
      )}

      {/* Feed variant: extra context */}
      {isFeed && (
        <div className="mt-3 rounded-md bg-zinc-900/50 px-3 py-2 text-xs text-zinc-500">
          Your partner earns points, you earn {bonusPercentage}% as a bonus. Help each other out!
        </div>
      )}
    </div>
  );
}
