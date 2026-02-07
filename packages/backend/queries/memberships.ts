import { query } from "../_generated/server";
import { v } from "convex/values";

export const getById = query({
  args: {
    membershipId: v.id("memberships"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.membershipId);
  },
});

export const getByUserAndWorkspace = query({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberships")
      .withIndex("userWorkspaceUnique", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId),
      )
      .first();
  },
});

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberships")
      .withIndex("workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const listByUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberships")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});
