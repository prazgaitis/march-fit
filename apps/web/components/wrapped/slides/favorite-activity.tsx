import { Star } from "lucide-react";

interface Props {
  favoriteActivity: { name: string; count: number; totalPoints: number };
  activityVariety: number;
}

export function FavoriteActivitySlide({
  favoriteActivity,
  activityVariety,
}: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <Star className="h-8 w-8 text-fuchsia-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6">
        Your Go-To
      </p>
      <p className="text-3xl font-black bg-gradient-to-r from-fuchsia-400 to-purple-400 bg-clip-text text-transparent">
        {favoriteActivity.name}
      </p>
      <p className="mt-3 text-sm text-zinc-400">
        {favoriteActivity.count} times for{" "}
        {favoriteActivity.totalPoints.toLocaleString()} pts
      </p>
      <div className="mt-8 rounded-xl bg-zinc-900/80 px-5 py-3 ring-1 ring-zinc-800">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
          Activity Types Tried
        </p>
        <p className="text-2xl font-bold tabular-nums text-white">
          {activityVariety}
        </p>
      </div>
    </div>
  );
}
