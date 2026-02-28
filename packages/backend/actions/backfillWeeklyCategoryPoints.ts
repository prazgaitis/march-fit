"use node";

/**
 * One-time backfill: populate the `weeklyCategoryPoints` table from existing activities.
 *
 * Run manually:
 *   npx convex run actions/backfillWeeklyCategoryPoints:backfillWeeklyCategoryPoints
 *   npx convex run actions/backfillWeeklyCategoryPoints:backfillWeeklyCategoryPoints --prod
 *
 * Safe to re-run — it clears existing weeklyCategoryPoints for each challenge before
 * writing fresh aggregations.
 */

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { getChallengeWeekNumber } from "../lib/weeks";

export const backfillWeeklyCategoryPoints = action({
  args: {},
  handler: async (ctx) => {
    // 1. Get all challenges
    const challenges: Array<{
      _id: Id<"challenges">;
      name: string;
      startDate: string | number;
    }> = await ctx.runQuery(internal.queries.challenges.listAll);

    console.log(`Found ${challenges.length} challenge(s)`);

    let totalWritten = 0;

    for (const challenge of challenges) {
      const challengeId = challenge._id;
      console.log(`\n📋 Processing: ${challenge.name}`);

      // 2. Load activity types → build activityTypeId → categoryId map
      const activityTypes = await ctx.runQuery(
        internal.queries.activityTypes.listByChallenge,
        { challengeId }
      );

      const categoryMap = new Map<string, Id<"categories">>();
      for (const at of activityTypes) {
        if (at.categoryId) {
          categoryMap.set(at._id as string, at.categoryId);
        }
      }

      if (categoryMap.size === 0) {
        console.log("  ⏭️  No categorized activity types, skipping");
        continue;
      }

      // 3. Clear existing weeklyCategoryPoints for this challenge
      const existing = await ctx.runQuery(
        internal.queries.backfillWeeklyCategoryPoints.listForChallenge,
        { challengeId }
      );
      if (existing.length > 0) {
        console.log(
          `  🗑️  Clearing ${existing.length} existing weeklyCategoryPoints rows`
        );
        const BATCH = 100;
        for (let i = 0; i < existing.length; i += BATCH) {
          await ctx.runMutation(
            internal.mutations.backfillWeeklyCategoryPoints.deleteBatch,
            {
              ids: existing.slice(i, i + BATCH).map((r: any) => r._id),
            }
          );
        }
      }

      // 4. Page through all activities and aggregate
      // Key: `${userId}|${categoryId}|${weekNumber}` → totalPoints
      const aggregation = new Map<string, number>();
      let cursor: string | undefined;
      let activityCount = 0;

      while (true) {
        const result = await ctx.runQuery(
          internal.queries.backfillWeeklyCategoryPoints.listActivitiesPage,
          { challengeId, cursor, pageSize: 500 }
        );

        for (const activity of result.page) {
          const categoryId = categoryMap.get(
            activity.activityTypeId as string
          );
          if (!categoryId) continue;

          const weekNumber = getChallengeWeekNumber(
            challenge.startDate,
            activity.loggedDate
          );
          if (weekNumber <= 0) continue;

          const key = `${activity.userId}|${categoryId}|${weekNumber}`;
          aggregation.set(
            key,
            (aggregation.get(key) ?? 0) + activity.pointsEarned
          );
        }

        activityCount += result.page.length;

        if (result.isDone) break;
        cursor = result.continueCursor;
      }

      console.log(
        `  📊 Scanned ${activityCount} activities → ${aggregation.size} (user, category, week) tuples`
      );

      // 5. Write aggregated rows in batches
      const rows: Array<{
        challengeId: Id<"challenges">;
        userId: Id<"users">;
        categoryId: Id<"categories">;
        weekNumber: number;
        totalPoints: number;
      }> = [];

      for (const [key, totalPoints] of aggregation) {
        if (totalPoints <= 0) continue;
        const [userId, categoryId, weekStr] = key.split("|") as [
          Id<"users">,
          Id<"categories">,
          string,
        ];
        rows.push({
          challengeId,
          userId,
          categoryId,
          weekNumber: Number(weekStr),
          totalPoints,
        });
      }

      const WRITE_BATCH = 50;
      for (let i = 0; i < rows.length; i += WRITE_BATCH) {
        const batch = rows.slice(i, i + WRITE_BATCH);
        await ctx.runMutation(
          internal.mutations.backfillWeeklyCategoryPoints.upsertBatch,
          { rows: batch }
        );
      }

      console.log(`  ✅ Wrote ${rows.length} weeklyCategoryPoints rows`);
      totalWritten += rows.length;
    }

    console.log(
      `\n🎉 Backfill complete — ${totalWritten} total rows written`
    );
    return { success: true, totalWritten };
  },
});
