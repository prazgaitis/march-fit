import { Sparkles } from "lucide-react";

interface Props {
  userName: string;
  challengeName: string;
  totalPoints: number;
  rank: number;
}

export function ThankYouSlide({
  userName,
  challengeName,
  totalPoints,
  rank,
}: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <Sparkles className="h-10 w-10 text-amber-400 mb-6" />
      <p className="text-2xl font-black bg-gradient-to-r from-amber-300 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
        That&apos;s a Wrap!
      </p>
      <p className="mt-4 text-sm text-zinc-400">
        {userName}, you crushed it in {challengeName}.
      </p>
      <div className="mt-8 flex gap-4">
        <div className="rounded-xl bg-zinc-900/80 px-5 py-3 ring-1 ring-zinc-800">
          <p className="text-2xl font-bold tabular-nums text-white">
            #{rank}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">
            Final Rank
          </p>
        </div>
        <div className="rounded-xl bg-zinc-900/80 px-5 py-3 ring-1 ring-zinc-800">
          <p className="text-2xl font-bold tabular-nums text-white">
            {totalPoints.toLocaleString()}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">
            Points
          </p>
        </div>
      </div>
      <p className="mt-8 text-xs text-zinc-600">
        See you next time
      </p>
    </div>
  );
}
