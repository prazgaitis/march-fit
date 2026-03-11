import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireCurrentUser } from "../lib/ids";
import { insertNotification } from "../lib/notifications";

export const poke = mutation({
  args: {
    userId: v.id("users"),
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    if (currentUser._id === args.userId) {
      throw new Error("Cannot poke yourself");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    const now = Date.now();

    await ctx.db.insert("pokes", {
      pokerId: currentUser._id,
      pokedId: args.userId,
      challengeId: args.challengeId,
      createdAt: now,
    });

    await insertNotification(ctx, {
      userId: args.userId,
      actorId: currentUser._id,
      type: "poke",
      data: { challengeId: args.challengeId },
      createdAt: now,
    });

    return { success: true };
  },
});
