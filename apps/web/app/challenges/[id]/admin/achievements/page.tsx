"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  Award,
  CheckCircle,
  Loader2,
  Plus,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AchievementsAdminPage() {
  const params = useParams();
  const challengeId = params.id as string;

  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Form state for new achievement
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    bonusPoints: "50",
    metric: "distance_km",
    threshold: "42",
    requiredCount: "3",
    frequency: "once_per_challenge" as "once_per_challenge" | "once_per_week" | "unlimited",
    selectedActivityTypeIds: [] as string[],
  });

  const achievements = useQuery(api.queries.achievements.getByChallengeId, {
    challengeId: challengeId as Id<"challenges">,
  });

  const activityTypes = useQuery(api.queries.activityTypes.getByChallengeId, {
    challengeId: challengeId as Id<"challenges">,
  });

  const createAchievement = useMutation(api.mutations.achievements.createAchievement);
  const deleteAchievement = useMutation(api.mutations.achievements.deleteAchievement);

  const handleCreate = async () => {
    if (formData.selectedActivityTypeIds.length === 0) {
      setSaveResult({ success: false, message: "Select at least one activity type" });
      return;
    }

    setIsSaving(true);
    setSaveResult(null);
    try {
      await createAchievement({
        challengeId: challengeId as Id<"challenges">,
        name: formData.name,
        description: formData.description,
        bonusPoints: parseInt(formData.bonusPoints) || 50,
        criteria: {
          activityTypeIds: formData.selectedActivityTypeIds as Id<"activityTypes">[],
          metric: formData.metric,
          threshold: parseFloat(formData.threshold) || 0,
          requiredCount: parseInt(formData.requiredCount) || 1,
        },
        frequency: formData.frequency,
      });

      setSaveResult({ success: true, message: "Achievement created" });
      setFormData({
        name: "",
        description: "",
        bonusPoints: "50",
        metric: "distance_km",
        threshold: "42",
        requiredCount: "3",
        frequency: "once_per_challenge",
        selectedActivityTypeIds: [],
      });
      setIsCreating(false);
    } catch (error) {
      setSaveResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to create",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (achievementId: string) => {
    if (!confirm("Delete this achievement? Users who earned it will lose the record.")) {
      return;
    }

    try {
      await deleteAchievement({
        achievementId: achievementId as Id<"achievements">,
      });
      setSaveResult({ success: true, message: "Achievement deleted" });
    } catch (error) {
      setSaveResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete",
      });
    }
  };

  const toggleActivityType = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedActivityTypeIds: prev.selectedActivityTypeIds.includes(id)
        ? prev.selectedActivityTypeIds.filter((x) => x !== id)
        : [...prev.selectedActivityTypeIds, id],
    }));
  };

  if (achievements === undefined || activityTypes === undefined) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
          <Award className="h-5 w-5 text-amber-400" />
          Achievements
        </h2>
        {!isCreating && (
          <Button
            size="sm"
            onClick={() => setIsCreating(true)}
            className="bg-amber-500 text-black hover:bg-amber-400"
          >
            <Plus className="mr-1 h-3 w-3" />
            New Achievement
          </Button>
        )}
      </div>

      {/* Result Message */}
      {saveResult && (
        <div
          className={cn(
            "rounded border p-3 text-sm",
            saveResult.success
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          )}
        >
          {saveResult.success ? (
            <CheckCircle className="mr-2 inline h-4 w-4" />
          ) : (
            <XCircle className="mr-2 inline h-4 w-4" />
          )}
          {saveResult.message}
        </div>
      )}

      {/* Create Form */}
      {isCreating && (
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-4 text-sm font-medium text-zinc-100">New Achievement</h3>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Marathon Club"
                  className="border-zinc-700 bg-zinc-800 text-zinc-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Bonus Points</Label>
                <Input
                  type="number"
                  value={formData.bonusPoints}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, bonusPoints: e.target.value }))
                  }
                  placeholder="50"
                  className="border-zinc-700 bg-zinc-800 text-zinc-200"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Description</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Complete 3 marathon-length activities"
                className="border-zinc-700 bg-zinc-800 text-zinc-200"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Qualifying Activity Types</Label>
              <div className="flex flex-wrap gap-2">
                {activityTypes.map((at: { _id: string; name: string }) => (
                  <button
                    key={at._id}
                    type="button"
                    onClick={() => toggleActivityType(at._id)}
                    className={cn(
                      "rounded px-2 py-1 text-xs transition-colors",
                      formData.selectedActivityTypeIds.includes(at._id)
                        ? "bg-amber-500 text-black"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    )}
                  >
                    {at.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Metric</Label>
                <select
                  value={formData.metric}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, metric: e.target.value }))
                  }
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                >
                  <option value="distance_km">Distance (km)</option>
                  <option value="distance_miles">Distance (miles)</option>
                  <option value="duration_minutes">Duration (minutes)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Threshold</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.threshold}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, threshold: e.target.value }))
                  }
                  placeholder="42"
                  className="border-zinc-700 bg-zinc-800 text-zinc-200"
                />
                <p className="text-[10px] text-zinc-500">
                  Minimum value to count
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Required Count</Label>
                <Input
                  type="number"
                  value={formData.requiredCount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, requiredCount: e.target.value }))
                  }
                  placeholder="3"
                  className="border-zinc-700 bg-zinc-800 text-zinc-200"
                />
                <p className="text-[10px] text-zinc-500">
                  How many qualifying activities needed
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Frequency</Label>
              <select
                value={formData.frequency}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    frequency: e.target.value as typeof formData.frequency,
                  }))
                }
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
              >
                <option value="once_per_challenge">Once per challenge</option>
                <option value="once_per_week">Once per week</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCreating(false)}
                className="border-zinc-700 text-zinc-400"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={isSaving || !formData.name}
                className="bg-amber-500 text-black hover:bg-amber-400"
              >
                {isSaving ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Save className="mr-1 h-3 w-3" />
                )}
                Create Achievement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Achievements List */}
      <div className="rounded border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-4 py-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            Configured Achievements
          </h3>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {achievements.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No achievements configured yet
            </div>
          ) : (
            achievements.map((achievement: { _id: string; name: string; description: string; bonusPoints: number; frequency: string; activityTypeNames?: string[]; criteria: { requiredCount: number; metric: string; threshold: number } }) => (
              <div
                key={achievement._id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-400" />
                    <span className="font-medium text-zinc-200">
                      {achievement.name}
                    </span>
                    <span className="text-xs text-emerald-400">
                      +{achievement.bonusPoints} pts
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {achievement.description}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-zinc-600">
                    <span>
                      {achievement.criteria.requiredCount}x {achievement.criteria.metric} &ge;{" "}
                      {achievement.criteria.threshold}
                    </span>
                    <span>•</span>
                    <span>
                      {achievement.activityTypeNames?.join(", ") || "No types"}
                    </span>
                    <span>•</span>
                    <span className="capitalize">
                      {achievement.frequency.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(achievement._id)}
                  className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
