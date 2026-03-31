import { Zap } from "lucide-react";

interface Props {
  prDay: {
    date: string;
    points: number;
    activities: Array<{ name: string; points: number }>;
  };
}

export function PrDaySlide({ prDay }: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <Zap className="h-8 w-8 text-yellow-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">
        Your Best Day
      </p>
      <p className="text-sm text-zinc-400 mb-6">{prDay.date}</p>
      <p className="text-5xl font-black tabular-nums bg-gradient-to-b from-yellow-300 to-amber-500 bg-clip-text text-transparent">
        {prDay.points}
      </p>
      <p className="mt-1 text-sm text-zinc-500">points in one day</p>
      <div className="mt-6 w-full space-y-1.5">
        {prDay.activities.map((a, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg bg-zinc-900/80 px-3 py-2 text-sm"
          >
            <span className="text-zinc-300">{a.name}</span>
            <span className="font-mono tabular-nums text-zinc-500">
              {Math.round(a.points)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
