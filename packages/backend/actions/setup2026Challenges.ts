"use node";

import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// Seed challenge names to delete
const SEED_CHALLENGES_TO_DELETE = [
  "Current Month Fitness Challenge",
  "Summer Shape-Up Challenge",
  "Spring Sprint Challenge",
  "March Fitness Challenge",
  "New Year, New You",
  "Holiday Wellness Challenge",
];

export const setup2026Challenges = action({
  args: {},
  handler: async (ctx) => {
    console.log("🗑️ Deleting seed challenges...");

    // Get all challenges
    const challenges = await ctx.runQuery(api.queries.challenges.listPublic, {
      limit: 100,
      offset: 0,
    });

    // Find and delete seed challenges
    const toDelete = challenges.filter((c: any) =>
      SEED_CHALLENGES_TO_DELETE.includes(c.name)
    );

    for (const challenge of toDelete) {
      console.log(`Deleting: ${challenge.name}`);
      await ctx.runMutation(internal.mutations.admin.deleteChallenge, {
        challengeId: challenge.id,
      });
    }

    console.log(`✅ Deleted ${toDelete.length} seed challenges`);

    // Get a user to be the creator (use the first admin from March Fitness 2025)
    const mf2025 = challenges.find((c: any) => c.name === "March Fitness 2025");
    if (!mf2025) {
      throw new Error("March Fitness 2025 not found - need it to get creator");
    }

    // Get the challenge details to find the creator
    const mf2025Full = await ctx.runQuery(api.queries.challenges.getById, {
      challengeId: mf2025.id,
    });

    if (!mf2025Full) {
      throw new Error("Could not load March Fitness 2025 details");
    }

    const creatorId = mf2025Full.creatorId;
    const now = Date.now();

    // February Warmup 2026: Feb 1-28, 2026
    console.log("🏋️ Creating February Warmup 2026...");
    const feb1_2026 = new Date("2026-02-01T00:00:00-06:00").getTime();
    const feb28_2026 = new Date("2026-02-28T23:59:59-06:00").getTime();

    const febWarmupId = await ctx.runMutation(
      internal.mutations.challenges.create,
      {
        name: "February Warmup 2026",
        description:
          "Get ready for March Fitness with this warmup challenge! Build your habits and get in shape before the main event.",
        creatorId: creatorId,
        startDate: feb1_2026,
        endDate: feb28_2026,
        durationDays: 28,
        streakMinPoints: 1,
        weekCalcMethod: "sunday",
        createdAt: now,
        updatedAt: now,
      }
    );
    console.log(`✅ Created February Warmup 2026: ${febWarmupId}`);

    // March Fitness 2026: Mar 1-31, 2026
    console.log("🏆 Creating March Fitness 2026...");
    const mar1_2026 = new Date("2026-03-01T00:00:00-06:00").getTime();
    const mar31_2026 = new Date("2026-03-31T23:59:59-05:00").getTime(); // Note: CDT by end of March

    const marchFitnessId = await ctx.runMutation(
      internal.mutations.challenges.create,
      {
        name: "March Fitness 2026",
        description:
          "The ultimate fitness challenge! Join hundreds of participants for 31 days of fitness, competition, and community.",
        creatorId: creatorId,
        startDate: mar1_2026,
        endDate: mar31_2026,
        durationDays: 31,
        streakMinPoints: 1,
        weekCalcMethod: "sunday",
        createdAt: now,
        updatedAt: now,
      }
    );
    console.log(`✅ Created March Fitness 2026: ${marchFitnessId}`);

    return {
      success: true,
      deleted: toDelete.map((c: any) => c.name),
      created: {
        februaryWarmup2026: febWarmupId,
        marchFitness2026: marchFitnessId,
      },
    };
  },
});
