import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const patchCloudinaryIds = internalMutation({
  args: {
    activityId: v.id("activities"),
    cloudinaryPublicIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.activityId, {
      cloudinaryPublicIds: args.cloudinaryPublicIds,
    });
  },
});
