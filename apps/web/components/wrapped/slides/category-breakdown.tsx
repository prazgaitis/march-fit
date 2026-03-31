import { PieChart } from "lucide-react";

interface Props {
  categoryBreakdown: Array<{
    name: string;
    points: number;
    percentage: number;
  }>;
}

const COLORS = [
  "bg-emerald-400",
  "bg-cyan-400",
  "bg-indigo-400",
  "bg-fuchsia-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-teal-400",
  "bg-violet-400",
];

export function CategoryBreakdownSlide({ categoryBreakdown }: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <PieChart className="h-8 w-8 text-emerald-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6">
        Where Your Points Came From
      </p>
      <div className="w-full space-y-2">
        {categoryBreakdown.slice(0, 8).map((cat, i) => (
          <div key={cat.name} className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${COLORS[i % COLORS.length]}`} />
            <span className="flex-1 text-left text-sm text-zinc-300 truncate">
              {cat.name}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${COLORS[i % COLORS.length]}`}
                  style={{ width: `${cat.percentage}%`, opacity: 0.7 }}
                />
              </div>
              <span className="w-8 text-right font-mono text-xs tabular-nums text-zinc-500">
                {cat.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
