import { internalQuery } from "../_generated/server";

/**
 * Find users whose avatarUrl points to Supabase storage.
 */
export const findUsersWithSupabaseAvatars = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => u.avatarUrl?.includes("supabase.co"))
      .map((u) => ({
        _id: u._id,
        name: u.name,
        avatarUrl: u.avatarUrl!,
      }));
  },
});
