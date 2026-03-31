import { Users } from "lucide-react";

interface FanInfo {
  name: string;
  avatarUrl: string | null;
  score: number;
}

interface Props {
  biggestFan: FanInfo | null;
  yourFavorite: FanInfo | null;
}

function PersonCard({
  label,
  person,
  accent,
}: {
  label: string;
  person: FanInfo;
  accent: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-zinc-900/80 px-5 py-5 ring-1 ring-zinc-800">
      <p className="text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      {person.avatarUrl ? (
        <img
          src={person.avatarUrl}
          alt=""
          className="h-14 w-14 rounded-full ring-2 ring-zinc-700"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 text-lg font-bold text-zinc-400">
          {person.name[0]}
        </div>
      )}
      <p className={`text-sm font-semibold ${accent}`}>{person.name}</p>
    </div>
  );
}

export function BiggestFanSlide({ biggestFan, yourFavorite }: Props) {
  if (!biggestFan && !yourFavorite) return null;

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <Users className="h-8 w-8 text-violet-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-8">
        Your People
      </p>
      <div className="flex w-full gap-3">
        {biggestFan && (
          <div className="flex-1">
            <PersonCard
              label="Your #1 Fan"
              person={biggestFan}
              accent="text-violet-400"
            />
          </div>
        )}
        {yourFavorite && (
          <div className="flex-1">
            <PersonCard
              label="Your Favorite"
              person={yourFavorite}
              accent="text-cyan-400"
            />
          </div>
        )}
      </div>
    </div>
  );
}
