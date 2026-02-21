"use client";

import { Fragment, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { Doc } from "@repo/backend/_generated/dataModel";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface BonusThreshold {
  metric: string;
  threshold: number;
  bonusPoints: number;
  description: string;
}

type ActivityType = Doc<"activityTypes">;

interface Category {
  _id: string;
  name: string;
  sortOrder: number;
}

interface AdminActivityTypesTableProps {
  challengeId: string;
  items: ActivityType[];
  categories: Category[];
}

const METRIC_OPTIONS = [
  { value: "distance_km", label: "km" },
  { value: "distance_miles", label: "mi" },
  { value: "duration_minutes", label: "min" },
];

export function AdminActivityTypesTable({
  challengeId,
  items,
  categories,
}: AdminActivityTypesTableProps) {
  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const categoryMap = new Map(categories.map((c) => [c._id, c.name]));
  const createActivityType = useMutation(api.mutations.activityTypes.createActivityType);
  const updateActivityType = useMutation(api.mutations.activityTypes.updateActivityType);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPoints, setCreatePoints] = useState("1");
  const [createContributes, setCreateContributes] = useState(true);
  const [createNegative, setCreateNegative] = useState(false);
  const [createCategoryId, setCreateCategoryId] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPoints, setEditPoints] = useState("");
  const [editContributes, setEditContributes] = useState(true);
  const [editNegative, setEditNegative] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editThresholds, setEditThresholds] = useState<BonusThreshold[]>([]);
  const [editScoringConfig, setEditScoringConfig] = useState<Record<string, unknown> | null>(null);

  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, setIsPending] = useState(false);

  const clearStatus = () => setTimeout(() => setStatusMessage(null), 3000);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      await createActivityType({
        challengeId: challengeId as Id<"challenges">,
        name: createName,
        description: createDescription || undefined,
        scoringConfig: { basePoints: Number(createPoints) || 1 },
        contributesToStreak: createContributes,
        isNegative: createNegative,
        categoryId: createCategoryId ? (createCategoryId as Id<"categories">) : undefined,
      });
      setCreateName("");
      setCreateDescription("");
      setCreatePoints("1");
      setCreateContributes(true);
      setCreateNegative(false);
      setCreateCategoryId("");
      setShowCreate(false);
      setStatusMessage({ type: "success", text: "Created" });
      clearStatus();
    } catch {
      setStatusMessage({ type: "error", text: "Failed to create" });
    } finally {
      setIsPending(false);
    }
  };

  const startEditing = (item: ActivityType) => {
    const scoringConfig = (item.scoringConfig as Record<string, unknown>) ?? {};
    const basePoints = getBasePoints(item);
    setEditingId(item._id);
    setEditName(item.name);
    setEditDescription(item.description ?? "");
    setEditPoints(String(basePoints));
    setEditContributes(item.contributesToStreak);
    setEditNegative(item.isNegative);
    setEditCategoryId((item.categoryId as string) ?? "");
    setEditThresholds((item.bonusThresholds as BonusThreshold[]) || []);
    setEditScoringConfig(scoringConfig);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditDescription("");
    setEditThresholds([]);
    setEditScoringConfig(null);
  };

  const withUpdatedPoints = (
    currentConfig: Record<string, unknown>,
    points: number
  ): Record<string, unknown> => {
    const nextConfig = { ...currentConfig };
    const scoringType = typeof nextConfig.type === "string" ? nextConfig.type : undefined;

    if (scoringType === "completion") {
      if ("fixedPoints" in nextConfig) {
        nextConfig.fixedPoints = points;
      } else {
        nextConfig.points = points;
      }
      return nextConfig;
    }

    if (
      scoringType === "unit_based" ||
      scoringType === "distance" ||
      scoringType === "duration" ||
      scoringType === "count" ||
      typeof nextConfig.unit === "string"
    ) {
      nextConfig.pointsPerUnit = points;
      return nextConfig;
    }

    nextConfig.basePoints = points;
    return nextConfig;
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setIsPending(true);
    try {
      const parsedPoints = Number(editPoints);
      const safePoints = Number.isFinite(parsedPoints) ? parsedPoints : 1;
      const nextScoringConfig = withUpdatedPoints(editScoringConfig ?? {}, safePoints);

      await updateActivityType({
        activityTypeId: editingId as Id<"activityTypes">,
        name: editName,
        description: editDescription || undefined,
        scoringConfig: nextScoringConfig,
        contributesToStreak: editContributes,
        isNegative: editNegative,
        bonusThresholds: editThresholds,
        categoryId: editCategoryId ? (editCategoryId as Id<"categories">) : undefined,
      });
      setEditingId(null);
      setEditDescription("");
      setEditThresholds([]);
      setEditScoringConfig(null);
      setStatusMessage({ type: "success", text: "Saved" });
      clearStatus();
    } catch {
      setStatusMessage({ type: "error", text: "Failed to save" });
    } finally {
      setIsPending(false);
    }
  };

  const addThreshold = () => {
    setEditThresholds([
      ...editThresholds,
      { metric: "distance_miles", threshold: 26.2, bonusPoints: 50, description: "Marathon bonus" },
    ]);
  };

  const removeThreshold = (index: number) => {
    setEditThresholds(editThresholds.filter((_, i) => i !== index));
  };

  const updateThreshold = (index: number, field: keyof BonusThreshold, value: string | number) => {
    setEditThresholds(
      editThresholds.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  };

  const getBasePoints = (item: ActivityType) => {
    const config = item.scoringConfig as Record<string, unknown>;
    return Number(config?.pointsPerUnit ?? config?.fixedPoints ?? config?.points ?? config?.basePoints ?? 1) || 1;
  };

  return (
    <div className="space-y-3">
      {/* Status Message */}
      {statusMessage && (
        <div
          className={cn(
            "flex items-center gap-2 rounded px-3 py-2 text-xs",
            statusMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          )}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {statusMessage.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Activity Types ({items.length})
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowCreate(!showCreate)}
          className="h-7 border-zinc-700 bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="rounded border border-zinc-800 bg-zinc-900 p-3"
        >
          <div className="mb-2">
            <label className="mb-1 block text-[10px] text-zinc-500">
              Name
            </label>
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Activity name"
              required
              className="h-8 border-zinc-700 bg-zinc-800 text-sm"
            />
          </div>
          <div className="mb-2">
            <label className="mb-1 block text-[10px] text-zinc-500">
              Description{" "}
              <span className="text-zinc-600">(supports markdown)</span>
            </label>
            <Textarea
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Describe how this activity scores points..."
              rows={3}
              className="resize-y border-zinc-700 bg-zinc-800 text-zinc-200 text-sm"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="w-20">
              <label className="mb-1 block text-[10px] text-zinc-500">Points</label>
              <Input
                value={createPoints}
                onChange={(e) => setCreatePoints(e.target.value)}
                className="h-8 border-zinc-700 bg-zinc-800 text-sm"
              />
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
              <input
                type="checkbox"
                checked={createContributes}
                onChange={(e) => setCreateContributes(e.target.checked)}
                className="h-3 w-3 rounded"
              />
              Streak
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
              <input
                type="checkbox"
                checked={createNegative}
                onChange={(e) => setCreateNegative(e.target.checked)}
                className="h-3 w-3 rounded"
              />
              Negative
            </label>
            <div className="w-32">
              <label className="mb-1 block text-[10px] text-zinc-500">Category</label>
              <select
                value={createCategoryId}
                onChange={(e) => setCreateCategoryId(e.target.value)}
                className="h-8 w-full rounded border border-zinc-700 bg-zinc-800 px-2 text-sm text-zinc-300"
              >
                <option value="">None</option>
                {sortedCategories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !createName}
              className="h-8 bg-amber-500 text-xs text-black hover:bg-amber-400"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowCreate(false)}
              className="h-8 px-2 text-zinc-500"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="rounded border border-zinc-800 bg-zinc-900">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">Points</th>
              <th className="px-3 py-2 text-center font-medium">Streak</th>
              <th className="px-3 py-2 text-center font-medium">Neg</th>
              <th className="px-3 py-2 text-center font-medium">Bonuses</th>
              <th className="px-3 py-2 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                  No activity types configured
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const basePoints = getBasePoints(item);
                const thresholds = (item.bonusThresholds as BonusThreshold[]) || [];
                const isEditing = editingId === item._id;

                return (
                  <Fragment key={item._id}>
                    <tr
                      className={cn(
                        "transition-colors",
                        isEditing ? "bg-zinc-800/50" : "hover:bg-zinc-800/30"
                      )}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <ChevronDown className="h-3 w-3 text-amber-400" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-zinc-600" />
                          )}
                          <span className="font-medium text-zinc-200">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-400">
                        {item.categoryId ? categoryMap.get(item.categoryId as string) ?? "—" : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">
                        {basePoints}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {item.contributesToStreak ? (
                          <span className="text-emerald-400">Yes</span>
                        ) : (
                          <span className="text-zinc-600">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {item.isNegative ? (
                          <span className="text-red-400">Yes</span>
                        ) : (
                          <span className="text-zinc-600">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {thresholds.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">
                            <Zap className="h-2.5 w-2.5" />
                            {thresholds.length}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => (isEditing ? cancelEditing() : startEditing(item))}
                          className={cn(
                            "text-[10px] font-medium uppercase tracking-wider",
                            isEditing
                              ? "text-zinc-500 hover:text-zinc-400"
                              : "text-amber-500 hover:text-amber-400"
                          )}
                        >
                          {isEditing ? "Close" : "Edit"}
                        </button>
                      </td>
                    </tr>

                    {/* Edit Panel */}
                    {isEditing && (
                      <tr>
                        <td colSpan={7} className="border-t border-zinc-800 bg-zinc-900 p-0">
                          <form onSubmit={handleUpdate} className="p-3">
                            {/* Basic Fields Row */}
                            <div className="flex items-end gap-3">
                              <div className="flex-1">
                                <label className="mb-1 block text-[10px] text-zinc-500">
                                  Name
                                </label>
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="h-8 border-zinc-700 bg-zinc-800 text-sm"
                                />
                              </div>
                              <div className="w-24">
                                <label className="mb-1 block text-[10px] text-zinc-500">
                                  Base Points
                                </label>
                                <Input
                                  value={editPoints}
                                  onChange={(e) => setEditPoints(e.target.value)}
                                  className="h-8 border-zinc-700 bg-zinc-800 text-sm"
                                />
                              </div>
                              <label className="flex items-center gap-1.5 pb-2 text-[10px] text-zinc-400">
                                <input
                                  type="checkbox"
                                  checked={editContributes}
                                  onChange={(e) => setEditContributes(e.target.checked)}
                                  className="h-3 w-3 rounded"
                                />
                                Streak
                              </label>
                              <label className="flex items-center gap-1.5 pb-2 text-[10px] text-zinc-400">
                                <input
                                  type="checkbox"
                                  checked={editNegative}
                                  onChange={(e) => setEditNegative(e.target.checked)}
                                  className="h-3 w-3 rounded"
                                />
                                Negative
                              </label>
                              <div className="w-36">
                                <label className="mb-1 block text-[10px] text-zinc-500">
                                  Category
                                </label>
                                <select
                                  value={editCategoryId}
                                  onChange={(e) => setEditCategoryId(e.target.value)}
                                  className="h-8 w-full rounded border border-zinc-700 bg-zinc-800 px-2 text-sm text-zinc-300"
                                >
                                  <option value="">None</option>
                                  {sortedCategories.map((c) => (
                                    <option key={c._id} value={c._id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Description Field */}
                            <div className="mt-3">
                              <label className="mb-1 block text-[10px] text-zinc-500">
                                Description{" "}
                                <span className="text-zinc-600">(supports markdown)</span>
                              </label>
                              <Textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                placeholder="Describe how this activity scores points..."
                                rows={3}
                                className="resize-y border-zinc-700 bg-zinc-800 text-zinc-200 text-sm"
                              />
                            </div>

                            {/* Bonus Thresholds Section */}
                            <div className="mt-3 border-t border-zinc-800 pt-3">
                              <div className="mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                                  <Zap className="h-3 w-3 text-amber-400" />
                                  Bonus Thresholds
                                </span>
                                <button
                                  type="button"
                                  onClick={addThreshold}
                                  className="flex items-center gap-1 text-[10px] text-amber-500 hover:text-amber-400"
                                >
                                  <Plus className="h-3 w-3" />
                                  Add threshold
                                </button>
                              </div>

                              {editThresholds.length === 0 ? (
                                <p className="text-[10px] text-zinc-600">
                                  No bonus thresholds configured. Add one to auto-award bonus points.
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  {editThresholds.map((threshold, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-2 rounded bg-zinc-800/50 px-2 py-1.5"
                                    >
                                      <span className="text-[10px] text-zinc-500">If</span>
                                      <select
                                        value={threshold.metric}
                                        onChange={(e) =>
                                          updateThreshold(idx, "metric", e.target.value)
                                        }
                                        className="h-6 rounded border-zinc-700 bg-zinc-800 px-1.5 text-[11px] text-zinc-300"
                                      >
                                        {METRIC_OPTIONS.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                      <span className="text-[10px] text-zinc-500">&ge;</span>
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={threshold.threshold}
                                        onChange={(e) =>
                                          updateThreshold(
                                            idx,
                                            "threshold",
                                            parseFloat(e.target.value) || 0
                                          )
                                        }
                                        className="h-6 w-16 rounded border border-zinc-700 bg-zinc-800 px-2 text-[11px] text-zinc-300"
                                      />
                                      <span className="text-[10px] text-zinc-500">then</span>
                                      <span className="text-[10px] text-emerald-400">+</span>
                                      <input
                                        type="number"
                                        value={threshold.bonusPoints}
                                        onChange={(e) =>
                                          updateThreshold(
                                            idx,
                                            "bonusPoints",
                                            parseInt(e.target.value) || 0
                                          )
                                        }
                                        className="h-6 w-14 rounded border border-zinc-700 bg-zinc-800 px-2 text-[11px] text-zinc-300"
                                      />
                                      <span className="text-[10px] text-zinc-500">pts</span>
                                      <input
                                        value={threshold.description}
                                        onChange={(e) =>
                                          updateThreshold(idx, "description", e.target.value)
                                        }
                                        placeholder="Label"
                                        className="h-6 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 text-[11px] text-zinc-300 placeholder:text-zinc-600"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeThreshold(idx)}
                                        className="p-1 text-zinc-600 hover:text-red-400"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="mt-3 flex items-center justify-end gap-2 border-t border-zinc-800 pt-3">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={cancelEditing}
                                className="h-7 text-xs text-zinc-500"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                size="sm"
                                disabled={isPending}
                                className="h-7 bg-amber-500 text-xs text-black hover:bg-amber-400"
                              >
                                {isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Save Changes"
                                )}
                              </Button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
