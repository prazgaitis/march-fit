import { Activity } from "lucide-react";

interface Props {
  totalActivities: number;
  avgActivitiesPerParticipant: number;
}

export function ActivityVolumeSlide({
  totalActivities,
  avgActivitiesPerParticipant,
}: Props) {
  const diff = totalActivities - avgActivitiesPerParticipant;
  const diffText =
    diff > 0
      ? `${diff} more than average`
      : diff < 0
        ? `${Math.abs(diff)} fewer than average`
        : "exactly average";

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <Activity className="h-8 w-8 text-cyan-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6">
        Activities Logged
      </p>
      <p className="text-7xl font-black tabular-nums bg-gradient-to-b from-cyan-300 to-cyan-600 bg-clip-text text-transparent">
        {totalActivities}
      </p>
      <p className="mt-4 text-sm text-zinc-400">{diffText}</p>
      <div className="mt-6 flex items-center gap-3 text-xs text-zinc-600">
        <span>Avg: {avgActivitiesPerParticipant}</span>
        <span className="text-zinc-800">|</span>
        <span>You: {totalActivities}</span>
      </div>
    </div>
  );
}
