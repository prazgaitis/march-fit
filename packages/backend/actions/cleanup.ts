"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * Delete all seed challenges (those with descriptions)
 */
export const deleteSeedChallenges = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get list of seed challenges
    const challenges = await ctx.runMutation(internal.mutations.cleanup.listSeedChallenges, {});

    console.log(`Found ${challenges.length} seed challenges to delete`);

    const results = [];
    for (const challenge of challenges) {
      console.log(`Deleting challenge: ${challenge.name} (${challenge.id})`);

      // Delete in batches
      let totalDeleted = 0;
      let batchNum = 0;
      while (true) {
        const result = await ctx.runMutation(internal.mutations.cleanup.deleteActivitiesBatch, {
          challengeId: challenge.id,
          batchSize: 100,
        });

        totalDeleted += result.deleted;
        batchNum++;
        console.log(`  Batch ${batchNum}: deleted ${result.deleted} activities (total: ${totalDeleted})`);

        if (!result.hasMore) break;
      }

      // Now delete the challenge and its other data
      const finalResult = await ctx.runMutation(internal.mutations.cleanup.deleteChallengeAfterActivities, {
        challengeId: challenge.id,
      });

      results.push({
        name: challenge.name,
        activitiesDeleted: totalDeleted,
        ...finalResult,
      });
    }

    return { success: true, results };
  },
});
