import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id, type TableNames } from "../_generated/dataModel";
import { ConvexError } from "convex/values";

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
 * Returns null if not authenticated — use requireCurrentUser for mutations.
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
 * Get the current authenticated user, throwing a ConvexError if not found.
 * Use this in mutations where authentication is required.
 * The structured error data lets clients detect session expiry and recover gracefully.
 */
export async function requireCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "unauthenticated",
      message: "Your session has expired. Please sign in again to continue.",
    });
  }

  if (identity.email) {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email as string))
      .first();
    if (user) return user;
  }

  throw new ConvexError({
    code: "unauthenticated",
    message: "Your session has expired. Please sign in again to continue.",
  });
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

