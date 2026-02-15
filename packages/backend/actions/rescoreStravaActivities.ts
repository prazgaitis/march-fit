"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * Re-score Strava activities that have 0 points but valid metrics.
 * This fixes activities that were scored before the metric alias resolution
 * was added in commit 082141c.
 */
export const rescoreStravaActivities = action({
  args: {
    challengeId: v.id("challenges"),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(
      internal.mutations.rescoreStrava.rescoreZeroPointActivities,
      {
        challengeId: args.challengeId,
        dryRun: args.dryRun ?? true,
      }
    );
    return result;
  },
});
