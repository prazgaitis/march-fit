import { Camera, Wine, Shuffle } from "lucide-react";

interface Props {
  photosShared: number;
  drinkPenalties: number;
  drinkPenaltyPoints: number;
  activityVariety: number;
}

export function FunStatsSlide({
  photosShared,
  drinkPenalties,
  drinkPenaltyPoints,
  activityVariety,
}: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-8">
        Fun Facts
      </p>
      <div className="w-full space-y-3">
        {photosShared > 0 && (
          <FunRow
            icon={<Camera className="h-4 w-4 text-sky-400" />}
            value={photosShared}
            label={`photo${photosShared !== 1 ? "s" : ""} shared`}
          />
        )}
        <FunRow
          icon={<Shuffle className="h-4 w-4 text-violet-400" />}
          value={activityVariety}
          label={`different activity type${activityVariety !== 1 ? "s" : ""} tried`}
        />
        {drinkPenalties > 0 && (
          <FunRow
            icon={<Wine className="h-4 w-4 text-rose-400" />}
            value={drinkPenalties}
            label={`drink penalt${drinkPenalties !== 1 ? "ies" : "y"} (-${drinkPenaltyPoints} pts)`}
          />
        )}
      </div>
    </div>
  );
}

function FunRow({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
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
