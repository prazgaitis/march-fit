"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Loader2,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AwardPreview {
  category: { id: string; name: string };
  leader: {
    userId: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
  weeklyPoints: number;
  bonusPoints: number;
  hasTie: boolean;
  tiedCount: number;
}

export default function CategoryLeadersPage() {
  const params = useParams();
  const challengeId = params.id as Id<"challenges">;

  const [bonusPoints, setBonusPoints] = useState(25);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [weekInitialized, setWeekInitialized] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{
    awarded: number;
    skipped: number;
    weekNumber: number;
  } | null>(null);

  const preview = useQuery(
    api.queries.categoryLeaderAwards.previewWeeklyAwards,
    { challengeId, weekNumber: selectedWeek, bonusPoints }
  );

  const applyAwards = useMutation(
    api.mutations.categoryLeaderAwards.applyWeeklyAwards
  );

  // Auto-select current week on first load
  const challenge = useQuery(api.queries.challenges.getById, { challengeId });
  if (preview && !weekInitialized) {
    const targetWeek = Math.min(preview.currentWeek, preview.totalWeeks);
    if (targetWeek !== selectedWeek) {
      setSelectedWeek(targetWeek);
    }
    setWeekInitialized(true);
  }

  const handleApply = async () => {
    setApplying(true);
    setResult(null);
    try {
      const res = await applyAwards({
        challengeId,
        weekNumber: selectedWeek,
        bonusPoints,
      });
      setResult(res);
    } finally {
      setApplying(false);
    }
  };

  if (!challenge) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-wider text-zinc-100">
            Category Leader Awards
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Award bonus points to weekly category leaders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Bonus pts</label>
          <Input
            type="number"
            value={bonusPoints}
            onChange={(e) => setBonusPoints(Number(e.target.value))}
            className="h-7 w-20 bg-zinc-900 text-center font-mono text-sm"
            min={1}
          />
        </div>
      </div>

      {/* Week Selector */}
      {preview && (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={selectedWeek <= 1}
            onClick={() =>
              setSelectedWeek((w) => Math.max(1, w - 1))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex flex-1 items-center justify-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">
              Week {preview.weekNumber}
            </span>
            <span className="text-xs text-zinc-500">
              of {preview.totalWeeks}
            </span>
            {preview.weekNumber === preview.currentWeek && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                Current
              </span>
            )}
            {preview.alreadyApplied && (
              <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
                <CheckCircle2 className="h-3 w-3" />
                Applied
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={selectedWeek >= preview.totalWeeks}
            onClick={() =>
              setSelectedWeek((w) => Math.min(preview.totalWeeks, w + 1))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Applied Weeks Summary */}
      {preview && preview.appliedWeeks.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          <span>
            Applied:{" "}
            {preview.appliedWeeks
              .sort((a: number, b: number) => a - b)
              .map((w: number) => `W${w}`)
              .join(", ")}
          </span>
        </div>
      )}

      {/* Awards Preview */}
      {!preview ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      ) : preview.awards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 py-12">
          <Trophy className="h-8 w-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            No category leaders for this week
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            <div className="col-span-4">Category</div>
            <div className="col-span-4">Leader</div>
            <div className="col-span-2 text-right">Week Pts</div>
            <div className="col-span-2 text-right">Bonus</div>
          </div>

          {preview.awards.map((award: AwardPreview) => (
            <div
              key={award.category.id}
              className="grid grid-cols-12 items-center gap-2 px-3 py-2.5 transition-colors hover:bg-zinc-800/30"
            >
              {/* Category */}
              <div className="col-span-4 flex items-center gap-2">
                <Crown className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-sm font-medium text-zinc-200">
                  {award.category.name}
                </span>
              </div>

              {/* Leader */}
              <div className="col-span-4 flex items-center gap-2">
                {award.leader.avatarUrl ? (
                  <img
                    src={award.leader.avatarUrl}
                    alt=""
                    className="h-5 w-5 rounded-full"
                  />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-400">
                    {(award.leader.name ?? award.leader.username)?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-sm text-zinc-300 truncate block">
                    {award.leader.name ?? award.leader.username}
                  </span>
                  {award.hasTie && (
                    <span className="text-[10px] text-amber-500">
                      {award.tiedCount}-way tie
                    </span>
                  )}
                </div>
              </div>

              {/* Week Points */}
              <div className="col-span-2 text-right font-mono text-sm text-zinc-400">
                {award.weeklyPoints}
              </div>

              {/* Bonus */}
              <div className="col-span-2 text-right font-mono text-sm font-medium text-emerald-400">
                +{award.bonusPoints}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Result Message */}
      {result && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            Week {result.weekNumber}: {result.awarded} award
            {result.awarded !== 1 ? "s" : ""} applied
            {result.skipped > 0 && `, ${result.skipped} skipped`}
          </span>
        </div>
      )}

      {/* Apply Button */}
      {preview && preview.awards.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleApply}
            disabled={applying || preview.alreadyApplied}
            className={cn(
              "gap-2",
              preview.alreadyApplied
                ? "bg-zinc-800 text-zinc-500"
                : "bg-amber-600 text-white hover:bg-amber-500"
            )}
          >
            {applying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : preview.alreadyApplied ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Award className="h-4 w-4" />
            )}
            {preview.alreadyApplied
              ? "Already Applied"
              : `Apply ${preview.awards.length} Award${preview.awards.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
  );
}
