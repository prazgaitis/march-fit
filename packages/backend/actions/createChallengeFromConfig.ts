"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

export const createChallengeFromConfig = action({
  args: {
    config: v.any(),
  },
  handler: async (ctx, { config }) => {
    const { challenge, creatorEmail, activityTypes } = config;

    // Look up creator by email
    const creator = await ctx.runQuery(internal.queries.users.getByEmail, {
      email: creatorEmail,
    });
    if (!creator) {
      throw new Error(`Creator not found for email: ${creatorEmail}`);
    }
    console.log(`Found creator: ${creator.name} (${creatorEmail})`);

    // Collect unique category names from activity types
    const categoryNames = [
      ...new Set(activityTypes.map((at: any) => at.category)),
    ];

    // Look up all categories by name
    const categoryMap: Record<string, Id<"categories">> = {};
    for (const name of categoryNames) {
      const cat = await ctx.runQuery(internal.queries.categories.getByName, {
        name: name as string,
      });
      if (!cat) {
        throw new Error(`Category not found: ${name}`);
      }
      categoryMap[name as string] = cat._id;
    }
    console.log(`Resolved ${Object.keys(categoryMap).length} categories`);

    // Calculate duration days
    const startMs = new Date(challenge.startDate).getTime();
    const endMs = new Date(challenge.endDate).getTime();
    const durationDays = Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24));

    const now = Date.now();

    // Create the challenge
    const challengeId = await ctx.runMutation(
      internal.mutations.challenges.create,
      {
        name: challenge.name,
        description: challenge.description,
        creatorId: creator._id,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
        durationDays,
        streakMinPoints: challenge.streakMinPoints,
        weekCalcMethod: challenge.weekCalcMethod,
        visibility: challenge.visibility,
        createdAt: now,
        updatedAt: now,
      }
    );
    console.log(`Created challenge: ${challenge.name} (${challengeId})`);

    // Add creator as participant
    await ctx.runMutation(internal.mutations.participations.create, {
      challengeId,
      userId: creator._id,
      joinedAt: now,
      totalPoints: 0,
      currentStreak: 0,
      modifierFactor: 1,
      paymentStatus: "paid",
      updatedAt: now,
    });
    console.log(`Added creator as participant`);

    // Create all activity types
    let count = 0;
    for (const at of activityTypes) {
      const { category, ...rest } = at;
      await ctx.runMutation(internal.mutations.activityTypes.create, {
        ...rest,
        categoryId: categoryMap[category],
        challengeId,
        createdAt: now,
        updatedAt: now,
      });
      count++;
    }

    console.log(
      `Created ${count} activity types for "${challenge.name}"`
    );

    return {
      success: true,
      challengeId,
      challengeName: challenge.name,
      activityTypesCreated: count,
    };
  },
});
