"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { BarChart3, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface Category {
  _id: string;
  name: string;
  description?: string;
  sortOrder?: number;
  showInCategoryLeaderboard?: boolean;
}

interface AdminCategoriesTableProps {
  initialCategories: Category[];
}

function CategoryRow({ category }: { category: Category }) {
  const updateCategory = useMutation(api.mutations.categories.updateCategory);
  const [pending, setPending] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | undefined>(undefined);

  const current = optimistic ?? category.showInCategoryLeaderboard ?? false;

  const handleToggle = async (checked: boolean) => {
    setOptimistic(checked);
    setPending(true);
    try {
      await updateCategory({
        categoryId: category._id as Id<"categories">,
        showInCategoryLeaderboard: checked,
      });
    } catch {
      // Revert on error
      setOptimistic(!checked);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      {/* Icon */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-zinc-800">
        <BarChart3 className="h-4 w-4 text-zinc-400" />
      </div>

      {/* Name + description */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-100">{category.name}</p>
        {category.description && (
          <p className="truncate text-xs text-zinc-500">{category.description}</p>
        )}
      </div>

      {/* Toggle */}
      <div className="flex flex-shrink-0 items-center gap-3">
        {pending && <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />}
        <span
          className={cn(
            "text-xs font-medium",
            current ? "text-emerald-400" : "text-zinc-500"
          )}
        >
          {current ? "On leaderboard" : "Hidden"}
        </span>
        <Switch
          checked={current}
          onCheckedChange={handleToggle}
          disabled={pending}
        />
      </div>
    </div>
  );
}

export function AdminCategoriesTable({ initialCategories }: AdminCategoriesTableProps) {
  const categories = useQuery(api.queries.categories.getAll, {}) ?? initialCategories;
  const createCategory = useMutation(api.mutations.categories.createCategory);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createSortOrder, setCreateSortOrder] = useState("");
  const [createShowInLeaderboard, setCreateShowInLeaderboard] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const clearStatus = () => setTimeout(() => setStatusMessage(null), 3000);

  const sorted = [...categories].sort((a, b) => {
    const aOrder = a.sortOrder ?? 9999;
    const bOrder = b.sortOrder ?? 9999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });

  const leaderboardCategories = sorted.filter(
    (c) => c.showInCategoryLeaderboard === true
  );
  const hiddenCategories = sorted.filter(
    (c) => c.showInCategoryLeaderboard !== true
  );

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createName.trim()) return;
    setCreatePending(true);
    try {
      const parsedSortOrder = Number(createSortOrder);
      await createCategory({
        name: createName.trim(),
        description: createDescription.trim() || undefined,
        sortOrder:
          createSortOrder !== "" && Number.isFinite(parsedSortOrder) ? parsedSortOrder : undefined,
        showInCategoryLeaderboard: createShowInLeaderboard,
      });
      setCreateName("");
      setCreateDescription("");
      setCreateSortOrder("");
      setCreateShowInLeaderboard(false);
      setStatusMessage({ type: "success", text: "Category created" });
      clearStatus();
    } catch {
      setStatusMessage({ type: "error", text: "Failed to create category" });
    } finally {
      setCreatePending(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-zinc-500">
        Toggle which categories appear on the{" "}
        <span className="font-medium text-zinc-300">Category Leader</span>{" "}
        leaderboard. Changes take effect immediately.
      </p>

      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="text-xs font-medium text-zinc-400">Name</label>
            <Input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="e.g. Women / Men / Open"
              disabled={createPending}
            />
          </div>
          <div className="w-32">
            <label className="text-xs font-medium text-zinc-400">Sort</label>
            <Input
              value={createSortOrder}
              onChange={(event) => setCreateSortOrder(event.target.value)}
              placeholder="10"
              inputMode="numeric"
              disabled={createPending}
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch
              checked={createShowInLeaderboard}
              onCheckedChange={setCreateShowInLeaderboard}
              disabled={createPending}
            />
            <span className="text-xs text-zinc-400">Show on leaderboard</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-400">Description</label>
          <Textarea
            value={createDescription}
            onChange={(event) => setCreateDescription(event.target.value)}
            placeholder="Optional description"
            disabled={createPending}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={createPending || !createName.trim()}>
            {createPending ? "Creating..." : "Create category"}
          </Button>
          {statusMessage && (
            <span
              className={cn(
                "text-xs font-medium",
                statusMessage.type === "success" ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {statusMessage.text}
            </span>
          )}
        </div>
      </form>

      {/* On leaderboard */}
      {leaderboardCategories.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            On Leaderboard
          </h4>
          {leaderboardCategories.map((cat) => (
            <CategoryRow key={cat._id} category={cat} />
          ))}
        </div>
      )}

      {/* Hidden */}
      {hiddenCategories.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Hidden from Leaderboard
          </h4>
          {hiddenCategories.map((cat) => (
            <CategoryRow key={cat._id} category={cat} />
          ))}
        </div>
      )}
    </div>
  );
}
