import { Heart } from "lucide-react";

interface Props {
  likesGiven: number;
  likesReceived: number;
}

export function SocialLikesSlide({ likesGiven, likesReceived }: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <Heart className="h-8 w-8 text-rose-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-8">
        Spreading the Love
      </p>
      <div className="flex w-full gap-4">
        <div className="flex-1 rounded-xl bg-zinc-900/80 py-5 ring-1 ring-zinc-800">
          <p className="text-3xl font-bold tabular-nums text-white">
            {likesGiven}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">
            Likes Given
          </p>
        </div>
        <div className="flex-1 rounded-xl bg-zinc-900/80 py-5 ring-1 ring-rose-500/20">
          <p className="text-3xl font-bold tabular-nums text-rose-400">
            {likesReceived}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">
            Likes Received
          </p>
        </div>
      </div>
    </div>
  );
}
