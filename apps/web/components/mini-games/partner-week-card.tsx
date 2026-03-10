"use client";

import { Users } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { formatPointsCompact } from "@/lib/points";

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
}

export function PartnerWeekCard({
  gameName,
  endsAt,
  challengeId,
  partner,
  partnerRank,
  partnerPeriodPoints,
  bonusPercentage = 10,
}: PartnerWeekCardProps) {
  const potentialBonus = Math.round(partnerPeriodPoints * (bonusPercentage / 100));

  const daysLeft = Math.max(
    0,
    Math.ceil((endsAt - Date.now()) / (1000 * 60 * 60 * 24))
  );

  return (
    <div className="rounded-lg border border-zinc-800 p-3">
      {/* Header row: game name + days left + bonus */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            {gameName}
          </span>
          <span className="text-xs text-zinc-700">·</span>
          <span className="text-xs text-zinc-600">
            {daysLeft}d left
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-xl font-bold text-emerald-400">
            +{formatPointsCompact(potentialBonus)}
          </span>
          <span className="text-[10px] text-zinc-600">bonus</span>
        </div>
      </div>

      {/* Partner row */}
      {partner && (
        <div className="flex items-center justify-between">
          <UserAvatar
            user={partner}
            challengeId={challengeId}
            size="md"
            showName
            showUsername
          >
            <p className="text-[10px] text-zinc-600">
              #{partnerRank ?? "?"} · {formatPointsCompact(partnerPeriodPoints)} pts this week
            </p>
          </UserAvatar>
        </div>
      )}
    </div>
  );
}
