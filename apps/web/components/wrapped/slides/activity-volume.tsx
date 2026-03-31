import { Activity } from "lucide-react";

interface Props {
  totalActivities: number;
}

export function ActivityVolumeSlide({ totalActivities }: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <Activity className="h-8 w-8 text-cyan-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6">
        Activities Logged
      </p>
      <p className="text-7xl font-black tabular-nums bg-gradient-to-b from-cyan-300 to-cyan-600 bg-clip-text text-transparent">
        {totalActivities}
      </p>
      <p className="mt-4 text-sm text-zinc-400">
        across the entire challenge
      </p>
    </div>
  );
}
