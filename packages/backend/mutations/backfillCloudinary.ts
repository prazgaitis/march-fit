import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Update a user's avatarUrl after migrating from Supabase to Cloudinary.
 */
export const patchUserAvatar = internalMutation({
  args: {
    userId: v.id("users"),
    avatarUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { avatarUrl: args.avatarUrl });
  },
});

/**
 * Patch an activity with cloudinaryPublicIds after backfill upload.
 */
export const patchCloudinaryIds = internalMutation({
  args: {
    activityId: v.id("activities"),
    cloudinaryPublicIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.activityId, {
      cloudinaryPublicIds: args.cloudinaryPublicIds,
      pendingMediaCount: undefined,
    });
  },
});

/**
 * Patch an activity with optimizedMediaIds (Cloudflare tagged IDs) after upload.
 * Used by the Strava webhook and the Cloudinary → Cloudflare backfill.
 */
export const patchOptimizedMediaIds = internalMutation({
  args: {
    activityId: v.id("activities"),
    optimizedMediaIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.activityId, {
      optimizedMediaIds: args.optimizedMediaIds,
      pendingMediaCount: undefined,
    });
  },
});
