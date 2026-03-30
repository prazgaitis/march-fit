import { Sun, Sunrise, Sunset, Moon } from "lucide-react";

interface Props {
  activityTimeDistribution: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  mostCommonTime: "morning" | "afternoon" | "evening" | "night";
}

const TIME_CONFIG = {
  morning: { label: "Morning", sublabel: "6am–12pm", icon: Sunrise, color: "text-amber-400", bg: "bg-amber-500/20" },
  afternoon: { label: "Afternoon", sublabel: "12pm–5pm", icon: Sun, color: "text-yellow-400", bg: "bg-yellow-500/20" },
  evening: { label: "Evening", sublabel: "5pm–9pm", icon: Sunset, color: "text-orange-400", bg: "bg-orange-500/20" },
  night: { label: "Night", sublabel: "9pm–6am", icon: Moon, color: "text-indigo-400", bg: "bg-indigo-500/20" },
};

export function TimeOfDaySlide({
  activityTimeDistribution,
  mostCommonTime,
}: Props) {
  const total = Object.values(activityTimeDistribution).reduce(
    (s, v) => s + v,
    0
  );
  const config = TIME_CONFIG[mostCommonTime];
  const Icon = config.icon;

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${config.bg} mb-4`}>
        <Icon className={`h-6 w-6 ${config.color}`} />
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">
        You&apos;re a
      </p>
      <p className={`text-3xl font-black ${config.color}`}>
        {config.label} Person
      </p>
      <p className="mt-2 text-sm text-zinc-500">{config.sublabel}</p>

      <div className="mt-8 w-full space-y-2">
        {(Object.entries(activityTimeDistribution) as Array<
          [keyof typeof TIME_CONFIG, number]
        >).map(([bucket, count]) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const c = TIME_CONFIG[bucket];
          return (
            <div key={bucket} className="flex items-center gap-3 text-xs">
              <span className="w-16 text-right text-zinc-500">
                {c.label}
              </span>
              <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${bucket === mostCommonTime ? "bg-gradient-to-r from-zinc-600 to-zinc-400" : "bg-zinc-700"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono tabular-nums text-zinc-600">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
