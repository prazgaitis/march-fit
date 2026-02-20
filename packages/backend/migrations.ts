import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { coerceDateOnlyToString } from "./lib/dateOnly";

export const migrations = new Migrations<DataModel>(components.migrations);

export const challengeDatesToDateOnly = migrations.define({
  table: "challenges",
  migrateOne: async (ctx, challenge) => {
    if (typeof challenge.startDate === "string" && typeof challenge.endDate === "string") {
      return;
    }

    const startDate = coerceDateOnlyToString(challenge.startDate);
    const endDate = coerceDateOnlyToString(challenge.endDate);

    await ctx.db.patch(challenge._id, {
      startDate,
      endDate,
    });
  },
});

// Set sortOrder on categories for display ordering on the Earning Points page
const categorySortOrders: Record<string, number> = {
  "Outdoor Running": 10,
  "Cycling": 20,
  "Rowing": 30,
  "High Intensity Cardio": 40,
  "Low Intensity Cardio": 50,
  "Horses": 60,
  "Special": 70,
  "Bonus": 80,
  "Penalty": 90,
};

export const setCategorySortOrder = migrations.define({
  table: "categories",
  migrateOne: async (ctx, category) => {
    const sortOrder = categorySortOrders[category.name];
    if (sortOrder !== undefined && category.sortOrder !== sortOrder) {
      await ctx.db.patch(category._id, { sortOrder });
    }
  },
});

// Move uncategorized activity types to correct categories and set sortOrder
// Targeted at March 2026 challenge: js7039jtvp6z79d0r37h1x70qn8105zw
const MARCH_2026_CHALLENGE = "js7039jtvp6z79d0r37h1x70qn8105zw" as Id<"challenges">;

const activityTypeFixes: Record<string, { categoryName: string; sortOrder: number }> = {
  // Walking for Fitness → Outdoor Running, sortOrder 20
  "jd77gc41rk0er5m1g0ym6m0xh181gvqg": { categoryName: "Outdoor Running", sortOrder: 20 },
  // 10 Days of Mindfulness Day 10 → Bonus, sortOrder 60
  "jd7035tdg9qv1czdx137s6x8nh810061": { categoryName: "Bonus", sortOrder: 60 },
  // Retro Abs Bonus → Bonus, sortOrder 50
  "jd7ak272rx2c0wzy4n3dkd5py1810bk3": { categoryName: "Bonus", sortOrder: 50 },
  // 10 Days of Mindfulness Days 1-9 → Bonus, sortOrder 55
  "jd71rzgeq2q4z46mkz0eq9s78981gs3t": { categoryName: "Bonus", sortOrder: 55 },
  // Thigh Burner → Special, sortOrder 100
  "jd78fatj1a7wdncmjrbwgxzavn81gj7y": { categoryName: "Special", sortOrder: 100 },
};

export const fixActivityTypeCategoriesAndOrder = migrations.define({
  table: "activityTypes",
  customRange: (query) =>
    query.withIndex("challengeId", (q) => q.eq("challengeId", MARCH_2026_CHALLENGE)),
  migrateOne: async (ctx, activityType) => {
    const fix = activityTypeFixes[activityType._id];
    if (fix) {
      const updates: Record<string, unknown> = { sortOrder: fix.sortOrder };
      if (fix.categoryName) {
        const category = await ctx.db
          .query("categories")
          .withIndex("name", (q) => q.eq("name", fix.categoryName))
          .first();
        if (category) {
          updates.categoryId = category._id;
        }
      }
      await ctx.db.patch(activityType._id, updates);
      return;
    }
    // Set sortOrder 10 on Outdoor Run by name (since we don't have its ID hardcoded)
    if (activityType.name === "Outdoor Run" && activityType.sortOrder === undefined) {
      await ctx.db.patch(activityType._id, { sortOrder: 10 });
    }
  },
});

export const run = migrations.runner();

export const runAll = action({
  args: {},
  handler: async (ctx) => {
    // Add new migrations to the END of this array.
    // The migrations component tracks state and skips completed ones.
    const migrationsList = [
      // Challenge date format normalization (2025)
      internal.migrations.challengeDatesToDateOnly,

      // Category sort order + activity type category fixes (2026-02)
      internal.migrations.setCategorySortOrder,
      internal.migrations.fixActivityTypeCategoriesAndOrder,
    ];

    await migrations.runSerially(ctx, migrationsList);
    return { success: true, count: migrationsList.length };
  },
});
