"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";

import { PartnerWeekCard } from "./partner-week-card";
import { HuntWeekCard } from "./hunt-week-card";
import { PrWeekCard } from "./pr-week-card";

interface ActiveMiniGamesProps {
  challengeId: string;
  userId: string;
}

export function ActiveMiniGames({ challengeId, userId }: ActiveMiniGamesProps) {
  const miniGameStatus = useQuery(api.queries.miniGames.getUserStatus, {
    challengeId: challengeId as Id<"challenges">,
    userId: userId as Id<"users">,
  });

  if (!miniGameStatus || miniGameStatus.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {miniGameStatus.map((status: (typeof miniGameStatus)[number]) => {
        const { miniGame, participation, liveData } = status;
        const config = miniGame.config as Record<string, number> | undefined;

        if (miniGame.type === "partner_week") {
          return (
            <PartnerWeekCard
              key={miniGame.id}
              gameName={miniGame.name}
              endsAt={miniGame.endsAt}
              challengeId={challengeId}
              partner={participation.partnerUser}
              initialState={{
                rank: (participation.initialState as { rank?: number })?.rank,
                points: liveData.partnerInitialPoints ?? 0,
              }}
              partnerCurrentPoints={liveData.partnerCurrentPoints}
              bonusPercentage={config?.bonusPercentage ?? 10}
            />
          );
        }

        if (miniGame.type === "hunt_week") {
          return (
            <HuntWeekCard
              key={miniGame.id}
              gameName={miniGame.name}
              endsAt={miniGame.endsAt}
              challengeId={challengeId}
              prey={participation.preyUser}
              hunter={participation.hunterUser}
              userCurrentPoints={liveData.userCurrentPoints}
              preyCurrentPoints={liveData.preyCurrentPoints}
              hunterCurrentPoints={liveData.hunterCurrentPoints}
              catchBonus={config?.catchBonus ?? 75}
              caughtPenalty={config?.caughtPenalty ?? 25}
            />
          );
        }

        if (miniGame.type === "pr_week") {
          const initialPr =
            (participation.initialState as { dailyPr?: number })?.dailyPr ?? 0;

          return (
            <PrWeekCard
              key={miniGame.id}
              gameName={miniGame.name}
              startsAt={miniGame.startsAt}
              endsAt={miniGame.endsAt}
              challengeId={challengeId}
              initialPr={initialPr}
              currentWeekMax={liveData.currentWeekMax ?? 0}
              prBonus={config?.prBonus ?? 100}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
