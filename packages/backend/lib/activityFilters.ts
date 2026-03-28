export const notDeleted = (q: any) => q.eq(q.field("deletedAt"), undefined);

export const isDeleted = (q: any) => q.neq(q.field("deletedAt"), undefined);

/** Sources that represent real user-logged activities (not system-generated bonuses). */
export const USER_ACTIVITY_SOURCES = new Set(["manual", "strava", "apple_health"]);

/** Returns true if the activity was logged by a user (not a system bonus like mini_game or category_leader). */
export function isUserLoggedActivity(activity: { source: string }): boolean {
  return USER_ACTIVITY_SOURCES.has(activity.source);
}

/** Activity type kinds that count toward PR day calculations (real fitness effort). */
export const PR_ELIGIBLE_KINDS = new Set(["core", "special", "penalty"]);

/** Returns true if the activity type kind is PR-eligible. Treats undefined kind as "core". */
export function isPrEligibleKind(kind: string | undefined): boolean {
  return PR_ELIGIBLE_KINDS.has(kind ?? "core");
}
