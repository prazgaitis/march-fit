import { internalQuery } from "../_generated/server";

export const list = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("templateActivityTypes").collect();
  },
});
