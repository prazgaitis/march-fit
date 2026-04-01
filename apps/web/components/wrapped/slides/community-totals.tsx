import { Users, Timer, MapPin, Mountain } from "lucide-react";

interface Props {
  communityTotals: {
    totalPoints: number;
    totalParticipants: number;
    totalCategoryEntries: number;
  };
  // Current user's own metrics to show alongside community stats
  userTotalMinutes: number;
  userTotalMiles: number;
  userTotalElevation: number;
}

export function CommunityTotalsSlide({
  communityTotals,
  userTotalMinutes,
  userTotalMiles,
  userTotalElevation,
}: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <Users className="h-8 w-8 text-emerald-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">
        Together, all {communityTotals.totalParticipants} of us earned
      </p>
      <p className="text-5xl font-black tabular-nums bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent mb-8">
        {communityTotals.totalPoints.toLocaleString()}
      </p>
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6">
        Total Points
      </p>

      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-3">
        Your contribution
      </p>
      <div className="w-full space-y-2">
        {userTotalMinutes > 0 && (
          <StatRow
            icon={<Timer className="h-4 w-4 text-cyan-400" />}
            value={Math.round(userTotalMinutes / 60).toLocaleString()}
            label="hours working out"
          />
        )}
        {userTotalMiles > 0 && (
          <StatRow
            icon={<MapPin className="h-4 w-4 text-rose-400" />}
            value={Math.round(userTotalMiles).toLocaleString()}
            label="miles covered"
          />
        )}
        {userTotalElevation > 0 && (
          <StatRow
            icon={<Mountain className="h-4 w-4 text-amber-400" />}
            value={Math.round(userTotalElevation * 3.28084).toLocaleString()}
            label="feet climbed"
          />
        )}
      </div>
    </div>
  );
}

function StatRow({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-zinc-900/80 px-4 py-3 ring-1 ring-zinc-800">
      {icon}
      <div className="text-left">
        <span className="text-xl font-bold tabular-nums text-white">
          {value}
        </span>
        <span className="ml-2 text-sm text-zinc-500">{label}</span>
      </div>
    </div>
  );
}
