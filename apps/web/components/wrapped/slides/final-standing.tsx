import { Trophy } from "lucide-react";

interface Props {
  totalPoints: number;
  rank: number;
  totalParticipants: number;
  challengeName: string;
}

export function FinalStandingSlide({
  totalPoints,
  rank,
  totalParticipants,
  challengeName,
}: Props) {
  const topPercent = Math.round((rank / totalParticipants) * 100);

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <Trophy className="h-10 w-10 text-amber-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">
        {challengeName}
      </p>
      <p className="text-6xl font-black tabular-nums bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
        #{rank}
      </p>
      <p className="mt-2 text-sm text-zinc-400">
        out of {totalParticipants} participants
      </p>
      <div className="mt-8 rounded-xl bg-zinc-900/80 px-6 py-4 ring-1 ring-zinc-800">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
          Total Points
        </p>
        <p className="text-3xl font-bold tabular-nums text-white">
          {totalPoints.toLocaleString()}
        </p>
      </div>
      {topPercent <= 25 && (
        <p className="mt-4 text-xs text-amber-400">
          Top {topPercent}% of all participants
        </p>
      )}
    </div>
  );
}
