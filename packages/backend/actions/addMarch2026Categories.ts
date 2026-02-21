"use node";

/**
 * Migration: Add "Yoga" and "Swimming" categories, reassign the matching
 * activity types in both 2026 challenges, and set showInCategoryLeaderboard
 * on all categories.
 *
 * Run with:
 *   npx convex run actions/addMarch2026Categories:addMarch2026Categories
 */

import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const CHALLENGE_NAMES = ["February Warmup 2026", "March Fitness 2026"];

// Which categories appear on the Category Leader leaderboard
const CATEGORY_LEADERBOARD_FLAGS: Record<string, { showInCategoryLeaderboard: boolean; description?: string; sortOrder?: number }> = {
  "Outdoor Running":    { showInCategoryLeaderboard: true },
  "Cycling":            { showInCategoryLeaderboard: true },
  "Rowing":             { showInCategoryLeaderboard: true },
  "High Intensity Cardio": { showInCategoryLeaderboard: true },
  "Low Intensity Cardio":  { showInCategoryLeaderboard: true },
  "Yoga":               { showInCategoryLeaderboard: true,  description: "Yoga, stretching, and mobility work", sortOrder: 10 },
  "Swimming":           { showInCategoryLeaderboard: false, description: "Pool or open water swimming", sortOrder: 11 },
  "Special":            { showInCategoryLeaderboard: false },
  "Bonus":              { showInCategoryLeaderboard: false },
  "Penalty":            { showInCategoryLeaderboard: false },
  "Horses":             { showInCategoryLeaderboard: false },
};

// Activity types per challenge to reassign to a new category
const REASSIGNMENTS: Array<{ categoryName: string; activityTypeNames: string[] }> = [
  { categoryName: "Yoga",     activityTypeNames: ["Yoga / Stretching"] },
  { categoryName: "Swimming", activityTypeNames: ["Swimming"] },
];

export const addMarch2026Categories = action({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // 1. Find both challenges
    const allChallenges = await ctx.runQuery(api.queries.challenges.listPublic, {
      limit: 100,
    });
    const challenges = CHALLENGE_NAMES.map((name) => {
      const found = allChallenges.find((c: any) => c.name === name);
      if (!found) throw new Error(`Challenge "${name}" not found`);
      return found;
    });
    console.log(`✅ Found challenges: ${challenges.map((c: any) => c.name).join(", ")}`);

    // 2. Upsert all categories with correct showInCategoryLeaderboard flag
    console.log("\n📁 Upserting categories...");
    const categoryIds: Record<string, Id<"categories">> = {};

    for (const [name, config] of Object.entries(CATEGORY_LEADERBOARD_FLAGS)) {
      const existing = await ctx.runQuery(internal.queries.categories.getByName, { name });

      if (existing) {
        categoryIds[name] = existing._id;
        // Update the flag (and optional fields) on existing categories
        await ctx.runMutation(internal.mutations.categories.updateInternal, {
          categoryId: existing._id,
          showInCategoryLeaderboard: config.showInCategoryLeaderboard,
          ...(config.description !== undefined && { description: config.description }),
          ...(config.sortOrder !== undefined && { sortOrder: config.sortOrder }),
        });
        const flag = config.showInCategoryLeaderboard ? "✅ leaderboard" : "🚫 hidden";
        console.log(`  ↩️  Updated "${name}" → ${flag}`);
      } else {
        // New category (Yoga / Swimming)
        categoryIds[name] = await ctx.runMutation(internal.mutations.categories.create, {
          name,
          description: config.description,
          sortOrder: config.sortOrder,
          showInCategoryLeaderboard: config.showInCategoryLeaderboard,
          createdAt: now,
          updatedAt: now,
        });
        const flag = config.showInCategoryLeaderboard ? "✅ leaderboard" : "🚫 hidden";
        console.log(`  ✅ Created "${name}" → ${flag}`);
      }
    }

    // 3. Reassign activity types in each challenge
    console.log("\n🔄 Reassigning activity types...");
    const results: Record<string, any> = {};

    for (const challenge of challenges) {
      const challengeId = challenge.id as Id<"challenges">;
      console.log(`\n  📋 ${challenge.name}`);

      const activityTypes = await ctx.runQuery(
        api.queries.activityTypes.getByChallengeId,
        { challengeId }
      );

      const challengeResults: Record<string, string[]> = {};

      for (const { categoryName, activityTypeNames } of REASSIGNMENTS) {
        const categoryId = categoryIds[categoryName];
        if (!categoryId) continue;

        const toUpdate = activityTypes.filter((at: any) =>
          activityTypeNames.includes(at.name)
        );

        if (toUpdate.length === 0) {
          console.log(`    ⚠️  No match for: ${activityTypeNames.join(", ")}`);
          continue;
        }

        const updated: string[] = [];
        for (const at of toUpdate) {
          await ctx.runMutation(internal.mutations.activityTypes.updateInternal, {
            activityTypeId: at._id,
            categoryId,
          });
          updated.push(at.name);
          console.log(`    🔄 "${at.name}" → "${categoryName}"`);
        }
        challengeResults[categoryName] = updated;
      }

      results[challenge.name] = challengeResults;
    }

    console.log("\n🎉 Done!");
    return { success: true, categoryIds, results };
  },
});
