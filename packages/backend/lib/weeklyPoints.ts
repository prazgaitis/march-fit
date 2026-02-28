import type { Id } from "../_generated/dataModel";
import { applyWeeklyCategoryPointsDelta } from "./weeklyCategoryPoints";

/**
 * Back-compat shim for legacy imports.
 * Weekly points are now stored in `weeklyCategoryPoints`.
 */
export async function applyWeeklyPointsDelta(
  ctx: any,
  args: {
    userId: Id<"users">;
    challengeId: Id<"challenges">;
    categoryId: Id<"categories"> | undefined;
    weekNumber: number;
    pointsDelta: number;
    now?: number;
  }
) {
  return applyWeeklyCategoryPointsDelta(ctx, args);
}
