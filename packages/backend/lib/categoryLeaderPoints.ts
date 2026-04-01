/**
 * Category Leader bonus point structure.
 *
 * Weekly:     weekNumber × multiplier
 * Cumulative: (totalWeeks + 1) × multiplier
 *
 * Multipliers: 1st = 10, 2nd = 5, 3rd = 3
 *
 * Example (4-week challenge):
 *   Week 1: 10 / 5 / 3
 *   Week 2: 20 / 10 / 6
 *   Week 3: 30 / 15 / 9
 *   Week 4: 40 / 20 / 12
 *   Cumulative: 50 / 25 / 15
 */

const PLACEMENT_MULTIPLIERS = [10, 5, 3] as const;

export const PLACEMENT_COUNT = PLACEMENT_MULTIPLIERS.length;

export function getWeeklyPlacementPoints(weekNumber: number): number[] {
  return PLACEMENT_MULTIPLIERS.map((m) => weekNumber * m);
}

export function getCumulativePlacementPoints(durationDays: number): number[] {
  // Use full award weeks (floor division) so partial stub weeks don't
  // inflate cumulative points. A 29-day challenge has 4 full weeks of
  // weekly awards, so cumulative = (4+1) × multiplier = 50/25/15.
  const awardWeeks = Math.floor(durationDays / 7);
  return PLACEMENT_MULTIPLIERS.map((m) => (awardWeeks + 1) * m);
}

export function placementLabel(placement: number): string {
  if (placement === 1) return "1st";
  if (placement === 2) return "2nd";
  if (placement === 3) return "3rd";
  return `${placement}th`;
}
