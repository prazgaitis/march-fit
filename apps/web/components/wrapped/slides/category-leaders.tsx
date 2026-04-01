import { Crown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Props {
  categoryLeaders: Array<{
    categoryName: string;
    userName: string;
    avatarUrl: string | null;
    totalPoints: number;
  }>;
}

export function CategoryLeadersSlide({ categoryLeaders }: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <Crown className="h-8 w-8 text-amber-400 mb-4" />
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">
        Category Leaders
      </p>
      <p className="text-xl font-black bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent mb-6">
        Who Dominated Each Category
      </p>
      <div className="w-full space-y-2 max-h-[50vh] overflow-y-auto">
        {categoryLeaders.map((leader) => (
          <div
            key={leader.categoryName}
            className="flex items-center gap-3 rounded-xl bg-zinc-900/80 px-4 py-3 ring-1 ring-zinc-800"
          >
            <Avatar className="h-7 w-7 flex-shrink-0">
              {leader.avatarUrl && <AvatarImage src={leader.avatarUrl} />}
              <AvatarFallback className="bg-zinc-700 text-[10px] text-zinc-300">
                {leader.userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {leader.userName}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                {leader.categoryName}
              </p>
            </div>
            <p className="text-sm font-bold tabular-nums text-amber-400 flex-shrink-0">
              {leader.totalPoints.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
