import { Flame } from "lucide-react";

interface Props {
  currentStreak: number;
}

export function StreakSlide({ currentStreak }: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <div className="relative mb-4">
        <Flame className="h-12 w-12 text-orange-400" />
        <div className="absolute inset-0 h-12 w-12 animate-pulse rounded-full bg-orange-500/20 blur-xl" />
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6">
        Streak
      </p>
      <p className="text-7xl font-black tabular-nums bg-gradient-to-b from-orange-300 to-red-500 bg-clip-text text-transparent">
        {currentStreak}
      </p>
      <p className="mt-2 text-lg font-medium text-zinc-300">
        day{currentStreak !== 1 ? "s" : ""} straight
      </p>
      {currentStreak >= 29 && (
        <p className="mt-6 text-sm font-semibold text-amber-400">
          Full challenge streak!
        </p>
      )}
      {currentStreak >= 20 && currentStreak < 29 && (
        <p className="mt-6 text-xs text-zinc-500">
          {29 - currentStreak} day{29 - currentStreak !== 1 ? "s" : ""} away from
          a full challenge streak
        </p>
      )}
    </div>
  );
}
