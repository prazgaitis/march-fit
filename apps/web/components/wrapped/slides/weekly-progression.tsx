import { TrendingUp } from "lucide-react";

interface Props {
  weeklyPoints: Array<{ week: number; points: number }>;
}

export function WeeklyProgressionSlide({ weeklyPoints }: Props) {
  const maxPoints = Math.max(...weeklyPoints.map((w) => w.points), 1);
  const bestWeek = weeklyPoints.reduce((best, w) =>
    w.points > best.points ? w : best
  );

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <TrendingUp className="h-8 w-8 text-indigo-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-8">
        Week by Week
      </p>
      <div className="flex w-full items-end justify-center gap-3">
        {weeklyPoints.map((w) => {
          const height = Math.max((w.points / maxPoints) * 140, 8);
          const isBest = w.week === bestWeek.week;
          return (
            <div key={w.week} className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-mono tabular-nums text-zinc-500">
                {w.points}
              </span>
              <div
                className={`w-10 rounded-t-md transition-all ${
                  isBest
                    ? "bg-gradient-to-t from-indigo-600 to-indigo-400"
                    : "bg-zinc-700"
                }`}
                style={{ height: `${height}px` }}
              />
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                W{w.week}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-zinc-500">
        Best week:{" "}
        <span className="text-indigo-400">
          Week {bestWeek.week} ({bestWeek.points} pts)
        </span>
      </p>
    </div>
  );
}
