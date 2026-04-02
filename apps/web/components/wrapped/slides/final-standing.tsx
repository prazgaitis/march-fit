import { Crown, Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface Winner {
  userId: string;
  placement: number;
  label?: string;
  userName: string;
  avatarUrl: string | null;
  totalPoints: number;
}

interface Props {
  totalPoints: number;
  rank: number;
  totalParticipants: number;
  challengeName: string;
  winners?: Winner[];
}

const PLACEMENT_COLORS: Record<number, string> = {
  1: "text-amber-400",
  2: "text-zinc-300",
  3: "text-amber-600",
};

export function FinalStandingSlide({
  totalPoints,
  rank,
  totalParticipants,
  challengeName,
  winners,
}: Props) {
  const topPercent = Math.round((rank / totalParticipants) * 100);
  const hasWinners = winners && winners.length > 0;

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <Trophy className="h-10 w-10 text-amber-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">
        {challengeName}
      </p>
      <p className="text-6xl font-black tabular-nums bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
        #{rank}
      </p>
      <p className="mt-2 text-sm text-zinc-400">
        out of {totalParticipants} participants
      </p>
      <div className="mt-8 rounded-xl bg-zinc-900/80 px-6 py-4 ring-1 ring-zinc-800">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
          Total Points
        </p>
        <p className="text-3xl font-bold tabular-nums text-white">
          {totalPoints.toLocaleString()}
        </p>
      </div>
      {topPercent <= 25 && (
        <p className="mt-4 text-xs text-amber-400">
          Top {topPercent}% of all participants
        </p>
      )}

      {/* Winners */}
      {hasWinners && (
        <div className="mt-8 w-full">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-amber-400">
            Champions
          </p>
          <div className="space-y-2">
            {winners.map((w) => {
              const Icon = w.placement === 1 ? Crown : Medal;
              const color = PLACEMENT_COLORS[w.placement] ?? "text-zinc-500";
              const isTie =
                winners.filter((x) => x.placement === w.placement).length > 1;

              return (
                <div
                  key={w.userId}
                  className="flex items-center gap-3 rounded-lg bg-zinc-900/60 px-4 py-2 ring-1 ring-zinc-800"
                >
                  <Icon className={cn("h-4 w-4 shrink-0", color)} />
                  <span className="flex-1 truncate text-sm font-semibold text-white">
                    {w.label ?? w.userName}
                  </span>
                  <span className="font-mono text-xs text-zinc-400">
                    {isTie ? "T-" : ""}
                    {w.placement === 1
                      ? "1st"
                      : w.placement === 2
                        ? "2nd"
                        : w.placement === 3
                          ? "3rd"
                          : `${w.placement}th`}
                  </span>
                  <span className="font-mono text-sm font-bold text-white">
                    {w.totalPoints.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
