import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id, type TableNames } from "../_generated/dataModel";

/**
 * Helper function to get a document by Convex ID.
 */
export async function getById<T extends TableNames>(
  ctx: QueryCtx | MutationCtx,
  table: T,
  id: Id<T> | undefined | null,
) {
  if (!id) return null;
  return ctx.db.get(id);
}

/**
 * Get the current authenticated user from the identity.
 * Links Better Auth users to our users table via email.
 */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // Look up user by email (Better Auth provides email in the identity)
  if (identity.email) {
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email as string))
      .first();
  }

  return null;
}

/**
 * Helper function to get a user by Convex ID
 */
export async function getUserById(
  ctx: QueryCtx | MutationCtx,
  id: Id<"users"> | undefined | null,
) {
  return getById(ctx, "users", id);
}

/**
 * Helper function to get a challenge by Convex ID
 */
export async function getChallengeById(
  ctx: QueryCtx | MutationCtx,
  id: Id<"challenges"> | undefined | null,
) {
  return getById(ctx, "challenges", id);
}

/**
 * Helper function to get an activity by Convex ID
 */
export async function getActivityById(
  ctx: QueryCtx | MutationCtx,
  id: Id<"activities"> | undefined | null,
) {
  return getById(ctx, "activities", id);
}

