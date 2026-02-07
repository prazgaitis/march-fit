import { query } from "../_generated/server";
import { v } from "convex/values";

export const getById = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.workspaceId);
  },
});

export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaces")
      .withIndex("slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const listByOwner = query({
  args: {
    ownerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaces")
      .withIndex("ownerId", (q) => q.eq("ownerId", args.ownerId))
      .collect();
  },
});

export const listForUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    if (!memberships.length) {
      return [];
    }

    const workspacePairs = await Promise.all(
      memberships.map(async (membership) => {
        const workspace = await ctx.db.get(membership.workspaceId);

        if (!workspace) {
          return null;
        }

        return {
          workspace,
          membership,
        };
      }),
    );

    return workspacePairs.filter(
      (workspacePair): workspacePair is NonNullable<typeof workspacePair> =>
        workspacePair !== null,
    );
  },
});
