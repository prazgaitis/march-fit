"use client";

import { Users } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { formatPointsCompact } from "@/lib/points";
import { cn } from "@/lib/utils";

import { MiniGameCardShell } from "./mini-game-card-shell";

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
    <MiniGameCardShell
      icon={Users}
      title={gameName}
      meta={`${daysLeft}d left`}
      iconClassName={cn(isFeed ? "h-4 w-4" : "h-3.5 w-3.5", "text-indigo-400")}
      compact={!isFeed}
      headerRight={
        <div className="text-right">
          <div
            className={cn(
              "font-mono font-bold text-emerald-400",
              isFeed ? "text-2xl" : "text-xl",
            )}
          >
            +{formatPointsCompact(potentialBonus)}
          </div>
          <div className={cn(isFeed ? "text-xs" : "text-[10px]", "text-zinc-600")}>
            bonus
          </div>
        </div>
      }
      bodyClassName={cn(isFeed && "space-y-0")}
      footer={
        isFeed
          ? `Your partner earns points, you earn ${bonusPercentage}% as a bonus. Help each other out!`
          : undefined
      }
    >
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
    </MiniGameCardShell>
  );
}
