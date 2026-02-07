"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { format } from "date-fns";
import {
  Calendar,
  Gamepad2,
  Plus,
  Target,
  Users,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MiniGameType = "partner_week" | "hunt_week" | "pr_week";
type MiniGameStatus = "draft" | "active" | "calculating" | "completed";

const gameTypeInfo: Record<
  MiniGameType,
  { label: string; icon: typeof Users; description: string }
> = {
  partner_week: {
    label: "Partner Week",
    icon: Users,
    description: "Players paired by rank, earn % of partner's points",
  },
  hunt_week: {
    label: "Hunt Week",
    icon: Target,
    description: "Hunt the player above you, avoid being caught",
  },
  pr_week: {
    label: "PR Week",
    icon: Zap,
    description: "Beat your daily point PR for a bonus",
  },
};

const statusStyles: Record<MiniGameStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-zinc-700 text-zinc-300" },
  active: { label: "Active", className: "bg-emerald-500/20 text-emerald-400" },
  calculating: { label: "Calculating", className: "bg-amber-500/20 text-amber-400" },
  completed: { label: "Completed", className: "bg-blue-500/20 text-blue-400" },
};

type MiniGameListItem = {
  id: Id<"miniGames">;
  type: string;
  status: string;
  name: string;
  startsAt: number;
  endsAt: number;
  participantCount: number;
};

export default function MiniGamesAdminPage() {
  const params = useParams();
  const router = useRouter();
  const challengeId = params.id as string;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newGame, setNewGame] = useState({
    type: "partner_week" as MiniGameType,
    name: "",
    startsAt: "",
    endsAt: "",
  });

  const miniGames = useQuery(api.queries.miniGames.list, {
    challengeId: challengeId as Id<"challenges">,
  });

  const challenge = useQuery(api.queries.challenges.getById, {
    challengeId: challengeId as Id<"challenges">,
  });

  const createMiniGame = useMutation(api.mutations.miniGames.create);

  const handleCreate = async () => {
    if (!newGame.name || !newGame.startsAt || !newGame.endsAt) return;

    try {
      await createMiniGame({
        challengeId: challengeId as Id<"challenges">,
        type: newGame.type,
        name: newGame.name,
        startsAt: new Date(newGame.startsAt).getTime(),
        endsAt: new Date(newGame.endsAt).getTime(),
      });

      setIsCreateOpen(false);
      setNewGame({
        type: "partner_week",
        name: "",
        startsAt: "",
        endsAt: "",
      });
    } catch (error) {
      console.error("Failed to create mini-game:", error);
      alert(error instanceof Error ? error.message : "Failed to create mini-game");
    }
  };

  if (!miniGames || !challenge) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  // Calculate default dates for new game
  const getDefaultDates = () => {
    const now = new Date();
    const start = new Date(Math.max(now.getTime(), challenge.startDate));
    const end = new Date(Math.min(start.getTime() + 7 * 24 * 60 * 60 * 1000, challenge.endDate));
    return {
      startsAt: start.toISOString().split("T")[0],
      endsAt: end.toISOString().split("T")[0],
    };
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500">
          {miniGames.length} mini-game{miniGames.length !== 1 ? "s" : ""}
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="h-7 bg-amber-500 px-3 text-xs text-black hover:bg-amber-400"
              onClick={() => {
                const defaults = getDefaultDates();
                setNewGame((prev) => ({
                  ...prev,
                  startsAt: defaults.startsAt,
                  endsAt: defaults.endsAt,
                }));
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              New Mini-Game
            </Button>
          </DialogTrigger>
          <DialogContent className="border-zinc-800 bg-zinc-900">
            <DialogHeader>
              <DialogTitle className="text-zinc-100">Create Mini-Game</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-zinc-400">Type</Label>
                <Select
                  value={newGame.type}
                  onValueChange={(value: MiniGameType) =>
                    setNewGame((prev) => ({
                      ...prev,
                      type: value,
                      name: prev.name || gameTypeInfo[value].label,
                    }))
                  }
                >
                  <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-800">
                    {Object.entries(gameTypeInfo).map(([type, info]) => (
                      <SelectItem
                        key={type}
                        value={type}
                        className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100"
                      >
                        <div className="flex items-center gap-2">
                          <info.icon className="h-4 w-4" />
                          {info.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-500">
                  {gameTypeInfo[newGame.type].description}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-400">Name</Label>
                <Input
                  value={newGame.name}
                  onChange={(e) =>
                    setNewGame((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Partner Week #1"
                  className="border-zinc-700 bg-zinc-800 text-zinc-200 placeholder:text-zinc-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Start Date</Label>
                  <Input
                    type="date"
                    value={newGame.startsAt}
                    onChange={(e) =>
                      setNewGame((prev) => ({ ...prev, startsAt: e.target.value }))
                    }
                    min={format(new Date(challenge.startDate), "yyyy-MM-dd")}
                    max={format(new Date(challenge.endDate), "yyyy-MM-dd")}
                    className="border-zinc-700 bg-zinc-800 text-zinc-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">End Date</Label>
                  <Input
                    type="date"
                    value={newGame.endsAt}
                    onChange={(e) =>
                      setNewGame((prev) => ({ ...prev, endsAt: e.target.value }))
                    }
                    min={newGame.startsAt || format(new Date(challenge.startDate), "yyyy-MM-dd")}
                    max={format(new Date(challenge.endDate), "yyyy-MM-dd")}
                    className="border-zinc-700 bg-zinc-800 text-zinc-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!newGame.name || !newGame.startsAt || !newGame.endsAt}
                  className="bg-amber-500 text-black hover:bg-amber-400"
                >
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Games List */}
      {miniGames.length > 0 ? (
        <div className="space-y-2">
          {miniGames.map((game: MiniGameListItem) => {
            const typeInfo = gameTypeInfo[game.type as MiniGameType];
            const status = statusStyles[game.status as MiniGameStatus];
            const Icon = typeInfo.icon;

            return (
              <button
                key={game.id}
                onClick={() =>
                  router.push(`/challenges/${challengeId}/admin/mini-games/${game.id}`)
                }
                className="w-full rounded border border-zinc-800 bg-zinc-900 p-3 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-zinc-800">
                      <Icon className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200">
                          {game.name}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium",
                            status.className
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {typeInfo.label}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-zinc-400">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(game.startsAt), "MMM d")} -{" "}
                      {format(new Date(game.endsAt), "MMM d")}
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1 text-xs text-zinc-500">
                      <Users className="h-3 w-3" />
                      {game.participantCount} participants
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded border border-zinc-800 bg-zinc-900 p-8 text-center">
          <Gamepad2 className="mx-auto h-8 w-8 text-zinc-600" />
          <div className="mt-2 text-sm text-zinc-400">No mini-games yet</div>
          <div className="mt-1 text-xs text-zinc-600">
            Create a mini-game to add variety to your challenge
          </div>
        </div>
      )}

      {/* Game Types Legend */}
      <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          Game Types
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(gameTypeInfo).map(([type, info]) => (
            <div key={type} className="flex items-start gap-2">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-zinc-800">
                <info.icon className="h-3 w-3 text-zinc-400" />
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-300">
                  {info.label}
                </div>
                <div className="text-[10px] text-zinc-500">{info.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
