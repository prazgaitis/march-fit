import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";

// Internal mutation for seeding
export const create = internalMutation({
  args: {
    username: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if user already exists by email
    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (existingByEmail) {
      return existingByEmail._id;
    }

    return await ctx.db.insert("users", {
      username: args.username,
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      role: args.role,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
    });
  },
});

// Emails that should always be admin
const ADMIN_EMAILS = ["prazgaitis@gmail.com", "paul@gocomplete.ai"];

// Public mutation for creating users (used by Better Auth user sync)
export const createUser = mutation({
  args: {
    username: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if user already exists by email
    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (existingByEmail) {
      // If user exists but should be admin and isn't, update them
      if (ADMIN_EMAILS.includes(args.email) && existingByEmail.role !== "admin") {
        await ctx.db.patch(existingByEmail._id, {
          role: "admin",
          updatedAt: now,
        });
      }
      return existingByEmail._id;
    }

    // Determine role - admin if in the admin emails list
    const role = ADMIN_EMAILS.includes(args.email) ? "admin" : (args.role ?? "user");

    return await ctx.db.insert("users", {
      username: args.username,
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      role,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Internal mutation for updating user role
export const updateRole = internalMutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      role: args.role,
      updatedAt: Date.now(),
    });
    return args.userId;
  },
});

// Internal mutation to ensure specific users are admins
export const ensureAdmins = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const email of ADMIN_EMAILS) {
      // Get ALL users with this email (in case of duplicates)
      const users = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("email"), email))
        .collect();

      for (const user of users) {
        if (user.role !== "admin") {
          await ctx.db.patch(user._id, {
            role: "admin",
            updatedAt: Date.now(),
          });
          console.log(`Updated ${email} (${user._id}) to admin`);
        }
      }
    }
  },
});

// Merge duplicate users by email - keeps the older user with historical data
export const mergeDuplicateByEmail = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Find all users with this email
    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .collect();

    if (users.length < 2) {
      return { merged: false, message: "No duplicates found" };
    }

    // Sort by createdAt to find oldest (the seeded one with historical data)
    users.sort((a, b) => a.createdAt - b.createdAt);
    const keepUser = users[0]; // oldest - has historical data
    const deleteUser = users[1]; // newer

    // Keep avatar from newer user if the older one doesn't have one
    await ctx.db.patch(keepUser._id, {
      avatarUrl: deleteUser.avatarUrl ?? keepUser.avatarUrl,
      updatedAt: Date.now(),
    });

    // Delete the newer duplicate user
    await ctx.db.delete(deleteUser._id);

    console.log(`Merged duplicate users for ${args.email}. Kept ${keepUser._id}, deleted ${deleteUser._id}`);

    return {
      merged: true,
      keptUserId: keepUser._id,
      deletedUserId: deleteUser._id,
    };
  },
});

/**
 * Find or create the current authenticated user from their auth identity.
 * Used as a server-side fallback when the normal user lookup fails.
 */
export const ensureCurrent = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) {
      return null;
    }

    const email = identity.email;

    // Try to find existing user
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      return existing;
    }

    // Create user from auth identity
    const now = Date.now();
    const name = identity.name || identity.givenName || email.split("@")[0];
    const username = identity.nickname || email.split("@")[0];
    const role = ADMIN_EMAILS.includes(email)
      ? ("admin" as const)
      : ("user" as const);

    const userId = await ctx.db.insert("users", {
      email,
      username,
      name,
      avatarUrl: identity.pictureUrl,
      role,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(userId);
  },
});

// Public mutation for updating users
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    age: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    const now = Date.now();

    await ctx.db.patch(userId, {
      ...updates,
      updatedAt: now,
    });

    return userId;
  },
});
