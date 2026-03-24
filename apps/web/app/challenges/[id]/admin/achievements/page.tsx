"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@/lib/convex-auth-react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import {
  Award,
  CheckCircle,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Trophy,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CriteriaType =
  | "count"
  | "cumulative"
  | "distinct_types"
  | "one_of_each"
  | "all_activity_type_thresholds"
  | "n_of_thresholds";
type Frequency = "once_per_challenge" | "once_per_week" | "unlimited";

interface FormData {
  name: string;
  description: string;
  bonusPoints: string;
  metric: string;
  threshold: string;
  requiredCount: string;
  frequency: Frequency;
  selectedActivityTypeIds: string[];
  unitConversionsJson: string;
}

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  bonusPoints: "100",
  metric: "distance_miles",
  threshold: "26.2",
  requiredCount: "3",
  frequency: "once_per_challenge",
  selectedActivityTypeIds: [],
  unitConversionsJson: "",
};

/** Build a human-readable summary of an achievement's criteria. */
function describeCriteria(achievement: any): string {
  const c = achievement.criteria;
  const type: string = c.criteriaType ?? c.type ?? "count";
  const typeNames: string = achievement.activityTypeNames?.join(", ") || "No types";

  switch (type) {
    case "count":
      return `${c.requiredCount}x ${c.metric} ≥ ${c.threshold} | Types: ${typeNames}`;
    case "cumulative":
      return `Cumulative ${c.metric} ≥ ${c.threshold} | Types: ${typeNames}`;
    case "distinct_types":
      return `Any ${c.requiredCount} of ${c.activityTypeIds?.length ?? 0} types | Types: ${typeNames}`;
    case "one_of_each":
      return `One of each: ${typeNames}`;
    case "all_activity_type_thresholds":
      return (c.requirements ?? [])
        .map((r: any, index: number) => {
          const label = achievement.activityTypeNames?.[index] ?? `Type ${index + 1}`;
          return `${label}: ${r.metric} ≥ ${r.threshold}`;
        })
        .join(" + ");
    case "n_of_thresholds":
      return `Any ${c.requiredCount} of: ` + (c.requirements ?? [])
        .map((r: any, index: number) => {
          const label = achievement.activityTypeNames?.[index] ?? `Type ${index + 1}`;
          return `${label}: ${r.metric} ≥ ${r.threshold}`;
        })
        .join(", ");
    default:
      return typeNames;
  }
}

/** Extract form data and criteria type from an existing achievement. */
function achievementToFormData(achievement: any): {
  formData: FormData;
  criteriaType: CriteriaType;
  perTypeThresholds: Record<string, string>;
} {
  const c = achievement.criteria;
  const ct: CriteriaType = (c.criteriaType ?? "count") as CriteriaType;

  const hasRequirements = ct === "all_activity_type_thresholds" || ct === "n_of_thresholds";
  const activityTypeIds: string[] = hasRequirements
    ? (c.requirements ?? []).map((r: any) => r.activityTypeId)
    : c.activityTypeIds ?? [];

  const perTypeThresholds: Record<string, string> = {};
  if (hasRequirements) {
    for (const r of c.requirements ?? []) {
      perTypeThresholds[r.activityTypeId] = String(r.threshold);
    }
  }

  let unitConversionsJson = "";
  if (ct === "cumulative" && c.unitConversions) {
    unitConversionsJson = JSON.stringify(c.unitConversions);
  }

  return {
    formData: {
      name: achievement.name,
      description: achievement.description ?? "",
      bonusPoints: String(achievement.bonusPoints),
      metric: c.metric ?? "distance_miles",
      threshold: String(c.threshold ?? "0"),
      requiredCount: String(c.requiredCount ?? "1"),
      frequency: achievement.frequency,
      selectedActivityTypeIds: activityTypeIds,
      unitConversionsJson,
    },
    criteriaType: ct,
    perTypeThresholds,
  };
}

// ---------------------------------------------------------------------------
// Achievement Form (shared between create & edit)
// ---------------------------------------------------------------------------

function AchievementForm({
  activityTypes,
  initialData,
  initialCriteriaType,
  initialPerTypeThresholds,
  isSaving,
  onSave,
  onCancel,
  submitLabel,
}: {
  activityTypes: { _id: string; name: string }[];
  initialData: FormData;
  initialCriteriaType: CriteriaType;
  initialPerTypeThresholds: Record<string, string>;
  isSaving: boolean;
  onSave: (data: {
    formData: FormData;
    criteriaType: CriteriaType;
    perTypeThresholds: Record<string, string>;
  }) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [criteriaType, setCriteriaType] = useState<CriteriaType>(initialCriteriaType);
  const [formData, setFormData] = useState<FormData>(initialData);
  const [perTypeThresholds, setPerTypeThresholds] = useState<Record<string, string>>(
    initialPerTypeThresholds,
  );

  const toggleActivityType = (id: string) => {
    const isSelected = formData.selectedActivityTypeIds.includes(id);
    setFormData((prev) => ({
      ...prev,
      selectedActivityTypeIds: isSelected
        ? prev.selectedActivityTypeIds.filter((x) => x !== id)
        : [...prev.selectedActivityTypeIds, id],
    }));
    setPerTypeThresholds((prev) => {
      if (isSelected) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: prev[id] ?? formData.threshold };
    });
  };

  const showMetricField =
    criteriaType === "count" ||
    criteriaType === "cumulative" ||
    criteriaType === "all_activity_type_thresholds" ||
    criteriaType === "n_of_thresholds";
  const showThresholdField = criteriaType === "count" || criteriaType === "cumulative";
  const showRequiredCountField =
    criteriaType === "count" || criteriaType === "distinct_types" || criteriaType === "n_of_thresholds";
  const showUnitConversions = criteriaType === "cumulative";
  const showPerTypeThresholds =
    criteriaType === "all_activity_type_thresholds" || criteriaType === "n_of_thresholds";

  return (
    <div className="space-y-4">
      {/* Name + Bonus Points */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Name</Label>
          <Input
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="March Fitness Triathlon"
            className="border-zinc-700 bg-zinc-800 text-zinc-200"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Bonus Points</Label>
          <Input
            type="number"
            value={formData.bonusPoints}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                bonusPoints: e.target.value,
              }))
            }
            placeholder="100"
            className="border-zinc-700 bg-zinc-800 text-zinc-200"
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label className="text-xs text-zinc-400">Description</Label>
        <Input
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              description: e.target.value,
            }))
          }
          placeholder="Complete any 3 of: Rowing, Outdoor Run, Swimming, Cycling"
          className="border-zinc-700 bg-zinc-800 text-zinc-200"
        />
      </div>

      {/* Criteria Type */}
      <div className="space-y-2">
        <Label className="text-xs text-zinc-400">Criteria Type</Label>
        <select
          value={criteriaType}
          onChange={(e) => setCriteriaType(e.target.value as CriteriaType)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="count">
            Count — N activities where metric ≥ threshold
          </option>
          <option value="cumulative">
            Cumulative — sum of metric across all activities ≥ threshold
          </option>
          <option value="distinct_types">
            Distinct Types — at least 1 activity from N different types
          </option>
          <option value="one_of_each">
            One of Each — at least 1 activity from every type in the list
          </option>
          <option value="all_activity_type_thresholds">
            Per-Type Thresholds — each selected type must meet its own threshold
          </option>
          <option value="n_of_thresholds">
            N-of Thresholds — any N of the selected types must meet their threshold
          </option>
        </select>
        <p className="text-[10px] text-zinc-500">
          {criteriaType === "count" &&
            "e.g. 'Log 3 runs of 10+ miles each'"}
          {criteriaType === "cumulative" &&
            "e.g. 'Run/cycle/row 100 total miles'"}
          {criteriaType === "distinct_types" &&
            "e.g. 'Do any 3 of: run, swim, row, cycle'"}
          {criteriaType === "one_of_each" &&
            "e.g. 'Complete every special challenge activity'"}
          {criteriaType === "all_activity_type_thresholds" &&
            "e.g. 'Run 26.2 mi + Swim 2.4 mi + Cycle 112 mi'"}
          {criteriaType === "n_of_thresholds" &&
            "e.g. 'Complete any 3 of: Run marathon, Cycle century, Swim 2.4mi, Row marathon'"}
        </p>
      </div>

      {/* Activity Types */}
      <div className="space-y-2">
        <Label className="text-xs text-zinc-400">
          Qualifying Activity Types
        </Label>
        <div className="flex flex-wrap gap-2">
          {activityTypes.map((at) => (
            <button
              key={at._id}
              type="button"
              onClick={() => toggleActivityType(at._id)}
              className={cn(
                "rounded px-2 py-1 text-xs transition-colors",
                formData.selectedActivityTypeIds.includes(at._id)
                  ? "bg-amber-500 text-black"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700",
              )}
            >
              {at.name}
            </button>
          ))}
        </div>
      </div>

      {/* Metric + Threshold */}
      {(showMetricField || showThresholdField) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {showMetricField && (
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Metric</Label>
              <select
                value={formData.metric}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metric: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
              >
                <option value="distance_miles">Distance (miles)</option>
                <option value="distance_km">Distance (km)</option>
                <option value="duration_minutes">Duration (minutes)</option>
              </select>
            </div>
          )}
          {showThresholdField && (
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">
                {criteriaType === "cumulative"
                  ? "Total Threshold"
                  : "Per-Activity Threshold"}
              </Label>
              <Input
                type="number"
                step="0.1"
                value={formData.threshold}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    threshold: e.target.value,
                  }))
                }
                placeholder={criteriaType === "cumulative" ? "100" : "26.2"}
                className="border-zinc-700 bg-zinc-800 text-zinc-200"
              />
              <p className="text-[10px] text-zinc-500">
                {criteriaType === "cumulative"
                  ? "Sum across all activities must reach this"
                  : "Each qualifying activity must reach this"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Required Count */}
      {showRequiredCountField && (
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Required Count</Label>
          <Input
            type="number"
            value={formData.requiredCount}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                requiredCount: e.target.value,
              }))
            }
            placeholder="3"
            className="w-40 border-zinc-700 bg-zinc-800 text-zinc-200"
          />
          <p className="text-[10px] text-zinc-500">
            {criteriaType === "count"
              ? "How many qualifying activities needed"
              : criteriaType === "n_of_thresholds"
                ? "How many of the thresholds must be met"
                : "How many distinct activity types needed"}
          </p>
        </div>
      )}

      {/* Unit Conversions (cumulative only) */}
      {showUnitConversions && (
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">
            Unit Conversions{" "}
            <span className="text-zinc-600">(optional JSON)</span>
          </Label>
          <Input
            value={formData.unitConversionsJson}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                unitConversionsJson: e.target.value,
              }))
            }
            placeholder={'{"<activityTypeId>": 0.621371}'}
            className="border-zinc-700 bg-zinc-800 font-mono text-xs text-zinc-200"
          />
          <p className="text-[10px] text-zinc-500">
            Per-type conversion factor applied before summing.
            Example: Rowing is logged in km but threshold is in miles →
            factor = 0.621371
          </p>
        </div>
      )}

      {/* Per-type thresholds */}
      {showPerTypeThresholds && (
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">
            Threshold per selected activity type
          </Label>
          <div className="space-y-2">
            {formData.selectedActivityTypeIds.length === 0 ? (
              <p className="text-[10px] text-zinc-500">
                Select activity types above to configure thresholds.
              </p>
            ) : (
              formData.selectedActivityTypeIds.map((id) => {
                const activityType = activityTypes.find((at) => at._id === id);
                return (
                  <div key={id} className="flex items-center gap-2">
                    <span className="w-40 text-xs text-zinc-300">
                      {activityType?.name ?? "Activity"}
                    </span>
                    <Input
                      type="number"
                      step="0.1"
                      value={perTypeThresholds[id] ?? ""}
                      onChange={(e) =>
                        setPerTypeThresholds((prev) => ({
                          ...prev,
                          [id]: e.target.value,
                        }))
                      }
                      placeholder="0"
                      className="w-40 border-zinc-700 bg-zinc-800 text-zinc-200"
                    />
                    <span className="text-[10px] text-zinc-500">
                      {formData.metric}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Frequency */}
      <div className="space-y-2">
        <Label className="text-xs text-zinc-400">Frequency</Label>
        <select
          value={formData.frequency}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              frequency: e.target.value as Frequency,
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
          onClick={onCancel}
          className="border-zinc-700 text-zinc-400"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onSave({ formData, criteriaType, perTypeThresholds })}
          disabled={isSaving || !formData.name}
          className="bg-amber-500 text-black hover:bg-amber-400"
        >
          {isSaving ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Save className="mr-1 h-3 w-3" />
          )}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AchievementsAdminPage() {
  const params = useParams();
  const challengeId = params.id as string;

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const achievements = useQuery(api.queries.achievements.getByChallengeId, {
    challengeId: challengeId as Id<"challenges">,
  });

  const activityTypes = useQuery(api.queries.activityTypes.getByChallengeId, {
    challengeId: challengeId as Id<"challenges">,
  });

  const earnedAchievements = useQuery(
    api.queries.achievements.getEarnedByChallenge,
    { challengeId: challengeId as Id<"challenges"> },
  );

  const createAchievement = useMutation(api.mutations.achievements.createAchievement);
  const updateAchievement = useMutation(api.mutations.achievements.updateAchievement);
  const deleteAchievement = useMutation(api.mutations.achievements.deleteAchievement);

  /** Build the criteria object from form state. */
  const buildCriteria = (
    formData: FormData,
    criteriaType: CriteriaType,
    perTypeThresholds: Record<string, string>,
  ) => {
    const typeIds = formData.selectedActivityTypeIds as Id<"activityTypes">[];
    switch (criteriaType) {
      case "count":
        return {
          criteriaType: "count" as const,
          activityTypeIds: typeIds,
          metric: formData.metric,
          threshold: parseFloat(formData.threshold) || 0,
          requiredCount: parseInt(formData.requiredCount) || 1,
        };
      case "cumulative": {
        let unitConversions: Record<string, number> | undefined;
        if (formData.unitConversionsJson.trim()) {
          try {
            unitConversions = JSON.parse(formData.unitConversionsJson);
          } catch {
            // ignore invalid JSON — will surface in save error
          }
        }
        return {
          criteriaType: "cumulative" as const,
          activityTypeIds: typeIds,
          metric: formData.metric,
          threshold: parseFloat(formData.threshold) || 0,
          ...(unitConversions ? { unitConversions } : {}),
        };
      }
      case "distinct_types":
        return {
          criteriaType: "distinct_types" as const,
          activityTypeIds: typeIds,
          requiredCount: parseInt(formData.requiredCount) || 1,
        };
      case "one_of_each":
        return {
          criteriaType: "one_of_each" as const,
          activityTypeIds: typeIds,
        };
      case "all_activity_type_thresholds":
        return {
          criteriaType: "all_activity_type_thresholds" as const,
          requirements: typeIds.map((activityTypeId) => ({
            activityTypeId,
            metric: formData.metric,
            threshold: parseFloat(perTypeThresholds[activityTypeId] || "0") || 0,
          })),
        };
      case "n_of_thresholds":
        return {
          criteriaType: "n_of_thresholds" as const,
          requiredCount: parseInt(formData.requiredCount) || 1,
          requirements: typeIds.map((activityTypeId) => ({
            activityTypeId,
            metric: formData.metric,
            threshold: parseFloat(perTypeThresholds[activityTypeId] || "0") || 0,
          })),
        };
    }
  };

  const validateForm = (
    formData: FormData,
    criteriaType: CriteriaType,
    perTypeThresholds: Record<string, string>,
  ): string | null => {
    if (formData.selectedActivityTypeIds.length === 0) {
      return "Select at least one activity type";
    }
    if (criteriaType === "all_activity_type_thresholds" || criteriaType === "n_of_thresholds") {
      const hasInvalidThreshold = formData.selectedActivityTypeIds.some(
        (id) => (parseFloat(perTypeThresholds[id] || "0") || 0) <= 0,
      );
      if (hasInvalidThreshold) {
        return "Set a threshold above 0 for every selected activity type";
      }
    }
    return null;
  };

  const handleCreate = async ({
    formData,
    criteriaType,
    perTypeThresholds,
  }: {
    formData: FormData;
    criteriaType: CriteriaType;
    perTypeThresholds: Record<string, string>;
  }) => {
    const error = validateForm(formData, criteriaType, perTypeThresholds);
    if (error) {
      setSaveResult({ success: false, message: error });
      return;
    }

    const criteria = buildCriteria(formData, criteriaType, perTypeThresholds);
    if (!criteria) return;

    setIsSaving(true);
    setSaveResult(null);
    try {
      await createAchievement({
        challengeId: challengeId as Id<"challenges">,
        name: formData.name,
        description: formData.description,
        bonusPoints: parseInt(formData.bonusPoints) || 100,
        criteria,
        frequency: formData.frequency,
      });

      setSaveResult({ success: true, message: "Achievement created" });
      setIsCreating(false);
    } catch (err) {
      setSaveResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to create",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async ({
    formData,
    criteriaType,
    perTypeThresholds,
  }: {
    formData: FormData;
    criteriaType: CriteriaType;
    perTypeThresholds: Record<string, string>;
  }) => {
    if (!editingId) return;

    const error = validateForm(formData, criteriaType, perTypeThresholds);
    if (error) {
      setSaveResult({ success: false, message: error });
      return;
    }

    const criteria = buildCriteria(formData, criteriaType, perTypeThresholds);
    if (!criteria) return;

    setIsSaving(true);
    setSaveResult(null);
    try {
      await updateAchievement({
        achievementId: editingId as Id<"achievements">,
        name: formData.name,
        description: formData.description,
        bonusPoints: parseInt(formData.bonusPoints) || 100,
        criteria,
        frequency: formData.frequency,
      });

      setSaveResult({ success: true, message: "Achievement updated" });
      setEditingId(null);
    } catch (err) {
      setSaveResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to update",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (achievementId: string) => {
    if (
      !confirm(
        "Delete this achievement? Users who earned it will lose the record.",
      )
    ) {
      return;
    }

    try {
      await deleteAchievement({
        achievementId: achievementId as Id<"achievements">,
      });
      setSaveResult({ success: true, message: "Achievement deleted" });
    } catch (err) {
      setSaveResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to delete",
      });
    }
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
        {!isCreating && !editingId && (
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
              : "border-red-500/30 bg-red-500/10 text-red-400",
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
          <h3 className="mb-4 text-sm font-medium text-zinc-100">
            New Achievement
          </h3>
          <AchievementForm
            activityTypes={activityTypes}
            initialData={EMPTY_FORM}
            initialCriteriaType="count"
            initialPerTypeThresholds={{}}
            isSaving={isSaving}
            onSave={handleCreate}
            onCancel={() => setIsCreating(false)}
            submitLabel="Create Achievement"
          />
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
            achievements.map((achievement: any) => {
              const isEditing = editingId === achievement._id;

              if (isEditing) {
                const { formData, criteriaType, perTypeThresholds } =
                  achievementToFormData(achievement);
                return (
                  <div key={achievement._id} className="p-4">
                    <h3 className="mb-4 text-sm font-medium text-zinc-100">
                      Edit: {achievement.name}
                    </h3>
                    <AchievementForm
                      activityTypes={activityTypes}
                      initialData={formData}
                      initialCriteriaType={criteriaType}
                      initialPerTypeThresholds={perTypeThresholds}
                      isSaving={isSaving}
                      onSave={handleUpdate}
                      onCancel={() => setEditingId(null)}
                      submitLabel="Save Changes"
                    />
                  </div>
                );
              }

              return (
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
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {achievement.criteria.criteriaType ?? "count"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {achievement.description}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-zinc-600">
                      <span>{describeCriteria(achievement)}</span>
                      <span>•</span>
                      <span className="capitalize">
                        {achievement.frequency.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(achievement._id);
                        setIsCreating(false);
                        setSaveResult(null);
                      }}
                      className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(achievement._id)}
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Earned Achievements */}
      <div className="rounded border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-4 py-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            <Trophy className="mr-1.5 inline h-3.5 w-3.5 text-amber-400" />
            Earned by Participants
            {earnedAchievements && earnedAchievements.length > 0 && (
              <span className="ml-2 text-zinc-500">
                ({earnedAchievements.length})
              </span>
            )}
          </h3>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {earnedAchievements === undefined ? (
            <div className="flex items-center justify-center px-4 py-8 text-sm text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : earnedAchievements.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No achievements earned yet
            </div>
          ) : (
            earnedAchievements.map((ea: any) => (
              <div key={ea.id} className="flex items-center gap-3 px-4 py-3">
                {ea.avatarUrl ? (
                  <img
                    src={ea.avatarUrl}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-500">
                    {(ea.userName?.[0] ?? "?").toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200 truncate">
                      {ea.userName}
                    </span>
                    <span className="text-xs text-zinc-500">earned</span>
                    <span className="text-sm text-amber-400 truncate">
                      {ea.achievementName}
                    </span>
                    <span className="text-xs text-emerald-400">
                      +{ea.bonusPoints}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-zinc-600 whitespace-nowrap">
                  {new Date(ea.earnedAt).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
