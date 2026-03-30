import { Award, Shield } from "lucide-react";

interface Props {
  achievementsEarned: Array<{ name: string; description: string }>;
  badgesEarned: Array<{
    name: string;
    icon: string | null;
    imagePublicId: string | null;
  }>;
}

export function AchievementsSlide({
  achievementsEarned,
  badgesEarned,
}: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <Award className="h-8 w-8 text-amber-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6">
        Unlocked
      </p>
      {achievementsEarned.length > 0 && (
        <div className="w-full space-y-2 mb-4">
          {achievementsEarned.map((a, i) => (
            <div
              key={i}
              className="rounded-lg bg-amber-500/10 px-4 py-2.5 ring-1 ring-amber-500/20 text-left"
            >
              <p className="text-sm font-medium text-amber-300">{a.name}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">
                {a.description}
              </p>
            </div>
          ))}
        </div>
      )}
      {badgesEarned.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">
            Badges
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {badgesEarned.map((b, i) => (
              <div
                key={i}
                className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-900 ring-1 ring-zinc-700"
                title={b.name}
              >
                <Shield className="h-6 w-6 text-zinc-400" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
