"use client";

import { Trophy, Crown, Medal } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { formatPoints } from "@/lib/points";
import { cn } from "@/lib/utils";

export interface Winner {
  userId: string;
  placement: number;
  label?: string;
  user?: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
  totalPoints?: number;
}

interface WinnersBannerProps {
  winners: Winner[];
  className?: string;
}

const PLACEMENT_CONFIG: Record<
  number,
  { icon: typeof Trophy; gradient: string; border: string; text: string }
> = {
  1: {
    icon: Crown,
    gradient: "from-amber-500/20 via-yellow-500/10 to-amber-500/20",
    border: "border-amber-500/30",
    text: "text-amber-400",
  },
  2: {
    icon: Medal,
    gradient: "from-zinc-400/10 via-zinc-300/5 to-zinc-400/10",
    border: "border-zinc-400/30",
    text: "text-zinc-300",
  },
  3: {
    icon: Medal,
    gradient: "from-amber-700/10 via-amber-600/5 to-amber-700/10",
    border: "border-amber-700/30",
    text: "text-amber-600",
  },
};

function placementLabel(placement: number): string {
  if (placement === 1) return "1st";
  if (placement === 2) return "2nd";
  if (placement === 3) return "3rd";
  return `${placement}th`;
}

export function WinnersBanner({ winners, className }: WinnersBannerProps) {
  if (winners.length === 0) return null;

  // Group by placement to detect ties
  const byPlacement = new Map<number, Winner[]>();
  for (const w of winners) {
    const list = byPlacement.get(w.placement) ?? [];
    list.push(w);
    byPlacement.set(w.placement, list);
  }

  const placements = Array.from(byPlacement.entries()).sort(
    (a, b) => a[0] - b[0],
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-transparent p-4",
        className,
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-center gap-2">
        <Trophy className="h-5 w-5 text-amber-400" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-amber-400">
          Winners
        </h2>
        <Trophy className="h-5 w-5 text-amber-400" />
      </div>

      {/* Winners */}
      <div className="space-y-3">
        {placements.map(([placement, group]) => {
          const config = PLACEMENT_CONFIG[placement] ?? PLACEMENT_CONFIG[3];
          const isTie = group.length > 1;
          const Icon = config.icon;

          return (
            <div key={placement} className="space-y-2">
              {group.map((winner) => (
                <div
                  key={winner.userId}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border bg-gradient-to-r px-4 py-3",
                    config.border,
                    config.gradient,
                  )}
                >
                  {/* Placement */}
                  <div className="flex flex-col items-center gap-0.5">
                    <Icon className={cn("h-5 w-5", config.text)} />
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        config.text,
                      )}
                    >
                      {isTie ? `T-${placementLabel(placement)}` : placementLabel(placement)}
                    </span>
                  </div>

                  {/* Avatar + Name */}
                  {winner.user && (
                    <UserAvatar
                      user={{
                        id: winner.user.id,
                        name: winner.user.name,
                        username: winner.user.username,
                        avatarUrl: winner.user.avatarUrl,
                      }}
                      challengeId=""
                      disableLink
                      size="sm"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-bold text-white">
                      {winner.label ??
                        winner.user?.name ??
                        winner.user?.username ??
                        "Unknown"}
                    </div>
                    {winner.totalPoints !== undefined && (
                      <span className="font-mono text-sm text-zinc-400">
                        {Math.trunc(winner.totalPoints).toLocaleString()} pts
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
