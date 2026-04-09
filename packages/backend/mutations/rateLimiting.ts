import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { rateLimiter } from "../lib/rateLimiter";

/**
 * Consume one token from the per-user API rate limit bucket.
 * Called from httpAction handlers after auth succeeds.
 * Returns { ok: true } when the request is allowed, or
 * { ok: false, retryAfter: <ms> } when the limit is exceeded.
 */
export const checkApiRateLimit = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const { ok, retryAfter } = await rateLimiter.limit(
      ctx,
      "mcpApiRequests",
      { key: args.userId }
    );
    return { ok, retryAfter: retryAfter ?? null };
  },
});
