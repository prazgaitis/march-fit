import { cache } from "react";
import { api } from "@repo/backend";
import type { Doc } from "@repo/backend/_generated/dataModel";

import { ApiError } from "./errors";
import { fetchAuthMutation, fetchAuthQuery, getToken } from "./server-auth";

/**
 * Get the current user from Convex, deduplicated per-request via React.cache.
 * Safe to call from multiple server components in the same render tree (layout + page)
 * without triggering redundant network round-trips.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<Doc<"users"> | null> {
  const token = await getToken();
  if (!token) {
    return null;
  }

  let user = null;

  // Use authenticated query first; if the user isn't in Convex yet, create them
  // from the Better Auth identity via an authenticated mutation.
  try {
    user = await fetchAuthQuery<Doc<"users"> | null>(api.queries.users.current, {});
    if (!user) {
      user = await fetchAuthMutation<Doc<"users"> | null>(
        api.mutations.users.ensureCurrent,
        {},
      );
    }
  } catch (error) {
    console.error("[auth] getCurrentUser failed:", error);
  }

  return user;
});

export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  return user;
}
