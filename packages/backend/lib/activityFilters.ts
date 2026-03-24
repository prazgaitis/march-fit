export const notDeleted = (q: any) => q.eq(q.field("deletedAt"), undefined);

export const isDeleted = (q: any) => q.neq(q.field("deletedAt"), undefined);

/** Sources that represent real user-logged activities (not system-generated bonuses). */
export const USER_ACTIVITY_SOURCES = new Set(["manual", "strava", "apple_health"]);

/** Returns true if the activity was logged by a user (not a system bonus like mini_game or category_leader). */
export function isUserLoggedActivity(activity: { source: string }): boolean {
  return USER_ACTIVITY_SOURCES.has(activity.source);
}
