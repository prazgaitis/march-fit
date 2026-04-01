import { Medal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Props {
  top10: Array<{
    rank: number;
    userName: string;
    avatarUrl: string | null;
    totalPoints: number;
    isCurrentUser: boolean;
  }>;
}

const RANK_STYLES: Record<number, string> = {
  1: "text-amber-400 ring-amber-500/30",
  2: "text-zinc-300 ring-zinc-400/30",
  3: "text-orange-400 ring-orange-500/30",
};

export function Top10LeaderboardSlide({ top10 }: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <Medal className="h-8 w-8 text-indigo-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">
        Final Standings
      </p>
      <p className="text-2xl font-black bg-gradient-to-r from-indigo-300 to-fuchsia-400 bg-clip-text text-transparent mb-6">
        Top 10
      </p>
      <div className="w-full space-y-1.5">
        {top10.map((entry) => {
          const rankStyle = RANK_STYLES[entry.rank];
          return (
            <div
              key={entry.rank}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 ring-1",
                entry.isCurrentUser
                  ? "bg-indigo-950/60 ring-indigo-500/40"
                  : "bg-zinc-900/80 ring-zinc-800"
              )}
            >
              <span
                className={cn(
                  "w-6 text-sm font-black tabular-nums",
                  rankStyle ?? "text-zinc-500"
                )}
              >
                {entry.rank}
              </span>
              <Avatar className="h-6 w-6 flex-shrink-0">
                {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} />}
                <AvatarFallback className="bg-zinc-700 text-[9px] text-zinc-300">
                  {entry.userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p
                className={cn(
                  "flex-1 text-left text-xs font-medium truncate",
                  entry.isCurrentUser ? "text-indigo-200" : "text-white"
                )}
              >
                {entry.userName}
                {entry.isCurrentUser && (
                  <span className="ml-1 text-[10px] text-indigo-400">
                    (you)
                  </span>
                )}
              </p>
              <p
                className={cn(
                  "text-sm font-bold tabular-nums flex-shrink-0",
                  rankStyle ?? "text-zinc-400"
                )}
              >
                {entry.totalPoints.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
