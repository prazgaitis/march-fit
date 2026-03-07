import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Sets the global bundle version to a specific value.
 * Called by the deploy script after each build to signal connected clients
 * that a new bundle is available.
 *
 * This is a public mutation (no auth) because it runs from `npx convex run`
 * in CI where there is no user session. The value is a monotonic timestamp
 * — setting it is idempotent and harmless.
 */
export const setBundleVersion = mutation({
  args: { version: v.number() },
  handler: async (ctx, { version }) => {
    const existing = await ctx.db
      .query("appConfig")
      .withIndex("key", (q) => q.eq("key", "global"))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        bundleVersion: version,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("appConfig", {
        key: "global" as const,
        bundleVersion: version,
        updatedAt: now,
      });
    }

    return version;
  },
});
