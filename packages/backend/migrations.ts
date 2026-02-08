import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { coerceDateOnlyToString } from "./lib/dateOnly";

export const migrations = new Migrations<DataModel>(components.migrations);

export const challengeDatesToDateOnly = migrations.define({
  table: "challenges",
  migrateOne: async (ctx, challenge) => {
    if (typeof challenge.startDate === "string" && typeof challenge.endDate === "string") {
      return;
    }

    const startDate = coerceDateOnlyToString(challenge.startDate);
    const endDate = coerceDateOnlyToString(challenge.endDate);

    await ctx.db.patch(challenge._id, {
      startDate,
      endDate,
    });
  },
});

export const run = migrations.runner();
export const runAll = migrations.runner(internal.migrations.challengeDatesToDateOnly);
