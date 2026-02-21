"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@repo/backend";
import type { Id } from "@repo/backend/_generated/dataModel";
import { BarChart3, Loader2 } from "lucide-react";

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
  categories: Category[];
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

export function AdminCategoriesTable({ categories }: AdminCategoriesTableProps) {
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

  return (
    <div className="space-y-6">
      <p className="text-xs text-zinc-500">
        Toggle which categories appear on the{" "}
        <span className="font-medium text-zinc-300">Category Leader</span>{" "}
        leaderboard. Changes take effect immediately.
      </p>

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
