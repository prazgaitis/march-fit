"use client";

import { Users } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
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
  initialState: {
    rank?: number;
    points?: number;
  };
  partnerCurrentPoints: number | null;
  bonusPercentage?: number;
}

export function PartnerWeekCard({
  gameName,
  endsAt,
  challengeId,
  partner,
  initialState,
  partnerCurrentPoints,
  bonusPercentage = 10,
}: PartnerWeekCardProps) {
  const partnerInitialPoints = initialState?.points ?? 0;
  const partnerWeekPoints =
    partnerCurrentPoints !== null
      ? partnerCurrentPoints - partnerInitialPoints
      : 0;
  const potentialBonus = Math.round(partnerWeekPoints * (bonusPercentage / 100));

  const daysLeft = Math.max(
    0,
    Math.ceil((endsAt - Date.now()) / (1000 * 60 * 60 * 24))
  );

  return (
    <div className="rounded-lg border border-zinc-800 bg-gradient-to-br from-indigo-950/50 to-zinc-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20">
            <Users className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{gameName}</h3>
            <p className="text-xs text-zinc-500">
              {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Potential Bonus</p>
          <p
            className={cn(
              "text-lg font-bold",
              potentialBonus > 0 ? "text-emerald-400" : "text-zinc-500"
            )}
          >
            +{potentialBonus}
          </p>
        </div>
      </div>

      {/* Partner Info */}
      {partner && (
        <div className="mt-4 rounded-lg bg-zinc-900/50 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Your Partner
          </p>
          <div className="flex items-center justify-between">
            <UserAvatar
              user={partner}
              challengeId={challengeId}
              size="md"
              showName
            >
              <p className="text-xs text-zinc-500">
                Rank #{initialState?.rank ?? "?"}
              </p>
            </UserAvatar>
            <div className="text-right">
              <p className="text-xs text-zinc-500">Week Points</p>
              <p className="text-xl font-bold text-indigo-400">
                {partnerWeekPoints.toFixed(0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bonus Calculation */}
      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {bonusPercentage}% of partner&apos;s points = your bonus
        </span>
      </div>
    </div>
  );
}
