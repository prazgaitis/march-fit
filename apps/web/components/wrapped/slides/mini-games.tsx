import { Gamepad2 } from "lucide-react";

interface Props {
  miniGameResults: Array<{
    type: string;
    partnerName?: string;
    outcome: string;
    bonusPoints: number;
  }>;
}

const TYPE_LABELS: Record<string, string> = {
  partner_week: "Partner Week",
  hunt_week: "The Hunt",
  pr_week: "PR Week",
};

export function MiniGamesSlide({ miniGameResults }: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <Gamepad2 className="h-8 w-8 text-lime-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6">
        Mini-Games
      </p>
      <div className="w-full space-y-3">
        {miniGameResults.map((game, i) => (
          <div
            key={i}
            className="rounded-xl bg-zinc-900/80 px-4 py-3 ring-1 ring-zinc-800 text-left"
          >
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
              {TYPE_LABELS[game.type] ?? game.type}
            </p>
            <p className="text-sm text-zinc-200">{game.outcome}</p>
            {game.bonusPoints > 0 && (
              <p className="mt-1 text-xs font-mono tabular-nums text-emerald-400">
                +{game.bonusPoints} pts
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
