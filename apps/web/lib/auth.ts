import { api } from "@repo/backend";
import type { Doc } from "@repo/backend/_generated/dataModel";

import { ApiError } from "./errors";
import { fetchAuthMutation, fetchAuthQuery, getToken } from "./server-auth";

export async function getCurrentUser(): Promise<Doc<"users"> | null> {
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
  } catch {
    // Auth query/mutation failed - user will remain null
  }

  return user;
}

export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  return user;
}
