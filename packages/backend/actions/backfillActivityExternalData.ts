"use node";

/**
 * One-time backfill: migrate externalData from activity documents to the
 * activityExternalData companion table.
 *
 * Run manually:
 *   npx convex run actions/backfillActivityExternalData:backfillActivityExternalData
 *   npx convex run actions/backfillActivityExternalData:backfillActivityExternalData --prod
 *
 * Safe to re-run — skips activities whose companion rows already exist.
 */

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

export const backfillActivityExternalData = action({
  args: {},
  handler: async (ctx) => {
    const challenges: Array<{ _id: Id<"challenges">; name: string }> =
      await ctx.runQuery(internal.queries.challenges.listAll);

    console.log(`Found ${challenges.length} challenge(s)`);

    let totalMigrated = 0;

    for (const challenge of challenges) {
      const challengeId = challenge._id;
      console.log(`\n📋 Processing: ${challenge.name}`);

      let cursor: string | undefined;
      let challengeMigrated = 0;

      while (true) {
        const result = await ctx.runQuery(
          internal.queries.backfillActivityExternalData
            .listActivitiesWithExternalData,
          { challengeId, cursor, pageSize: 100 }
        );

        if (result.page.length > 0) {
          await ctx.runMutation(
            internal.mutations.backfillActivityExternalData.migrateBatch,
            { rows: result.page }
          );
          challengeMigrated += result.page.length;
        }

        if (result.isDone) break;
        cursor = result.continueCursor;
      }

      console.log(
        `  ✅ Migrated ${challengeMigrated} activities with externalData`
      );
      totalMigrated += challengeMigrated;
    }

    console.log(
      `\n🎉 Migration complete — ${totalMigrated} total activities migrated`
    );
    return { success: true, totalMigrated };
  },
});
