import { query } from "../_generated/server";

/**
 * Returns the current bundle version from the global appConfig document.
 * Clients subscribe to this to detect when a new deploy has occurred.
 */
export const getBundleVersion = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db
      .query("appConfig")
      .withIndex("key", (q) => q.eq("key", "global"))
      .first();
    return config?.bundleVersion ?? 0;
  },
});
