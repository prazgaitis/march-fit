"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Pointer, Loader2, Users } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
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
          <PokePartnerButton partnerId={partner.id} challengeId={challengeId} compact={!isFeed} />
        </div>
      )}
    </MiniGameCardShell>
  );
}

function PokePartnerButton({
  partnerId,
  challengeId,
  compact,
}: {
  partnerId: string;
  challengeId: string;
  compact: boolean;
}) {
  const [isPoking, setIsPoking] = useState(false);
  const [didPoke, setDidPoke] = useState(false);
  const pokeMutation = useMutation(api.mutations.pokes.poke);

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("shrink-0", compact && "h-7 text-xs")}
      disabled={isPoking || didPoke}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsPoking(true);
        try {
          await pokeMutation({
            userId: partnerId as Id<"users">,
            challengeId: challengeId as Id<"challenges">,
          });
          setDidPoke(true);
        } catch (error) {
          console.error("Failed to poke partner:", error);
        } finally {
          setIsPoking(false);
        }
      }}
    >
      {isPoking ? (
        <Loader2 className={cn("animate-spin", compact ? "h-3 w-3" : "h-4 w-4")} />
      ) : (
        <>
          <Pointer className={cn("mr-1 rotate-90", compact ? "h-3 w-3" : "h-4 w-4")} />
          {didPoke ? "Poked!" : "Poke"}
        </>
      )}
    </Button>
  );
}
