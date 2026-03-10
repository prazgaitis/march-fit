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
