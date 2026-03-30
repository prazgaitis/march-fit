import { MapPin, Clock, Mountain } from "lucide-react";

interface Props {
  totalDistanceMiles: number;
  totalMinutes: number;
  totalElevationMeters: number;
}

export function DistanceTimeSlide({
  totalDistanceMiles,
  totalMinutes,
  totalElevationMeters,
}: Props) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-8">
        By the Numbers
      </p>
      <div className="space-y-6 w-full">
        {totalDistanceMiles > 0 && (
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20">
              <MapPin className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold tabular-nums text-white">
                {totalDistanceMiles.toLocaleString()} mi
              </p>
              <p className="text-xs text-zinc-500">total distance</p>
            </div>
          </div>
        )}
        {totalMinutes > 0 && (
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/20">
              <Clock className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold tabular-nums text-white">
                {hours}h {mins}m
              </p>
              <p className="text-xs text-zinc-500">time active</p>
            </div>
          </div>
        )}
        {totalElevationMeters > 0 && (
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
              <Mountain className="h-5 w-5 text-amber-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold tabular-nums text-white">
                {Math.round(totalElevationMeters).toLocaleString()}m
              </p>
              <p className="text-xs text-zinc-500">elevation gained</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
