import "server-only";

import { auth as clerkAuth } from "@clerk/nextjs/server";

import { api } from "@repo/backend";
import { getConvexClient } from "./convex-server";

type AuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

type ServerAuthResult = {
  userId: string | null;
  convexToken: string | null;
  user: AuthUser | null;
};

export async function isAuthenticated() {
  const session = await clerkAuth();
  return Boolean(session.userId);
}

export async function getToken() {
  const session = await clerkAuth();
  return await session.getToken({ template: "convex" });
}

export async function fetchAuthQuery<T>(query: any, args: Record<string, unknown>): Promise<T> {
  const convex = getConvexClient();
  const token = await getToken();
  if (token) {
    convex.setAuth(token);
  }
  return convex.query(query, args) as Promise<T>;
}

export async function fetchAuthMutation<T>(mutation: any, args: Record<string, unknown>): Promise<T> {
  const convex = getConvexClient();
  const token = await getToken();
  if (token) {
    convex.setAuth(token);
  }
  return convex.mutation(mutation, args) as Promise<T>;
}

export async function fetchAuthAction<T>(action: any, args: Record<string, unknown>): Promise<T> {
  const convex = getConvexClient();
  const token = await getToken();
  if (token) {
    convex.setAuth(token);
  }
  return convex.action(action, args) as Promise<T>;
}

export async function getServerAuth(): Promise<ServerAuthResult> {
  // Parallelize token + auth check instead of sequential calls
  const [token, authenticated] = await Promise.all([
    getToken(),
    isAuthenticated(),
  ]);

  if (!authenticated || !token) {
    return {
      userId: null,
      convexToken: token ?? null,
      user: null,
    };
  }

  try {
    let user = await fetchAuthQuery<{
      _id: string;
      email: string;
      name?: string;
      avatarUrl?: string;
    } | null>(api.queries.users.current, {});

    if (!user) {
      user = await fetchAuthMutation(api.mutations.users.ensureCurrent, {});
    }

    if (user) {
      return {
        userId: user._id,
        convexToken: token ?? null,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
        },
      };
    }
  } catch (error) {
    console.error("[server-auth] getServerAuth failed:", error);
  }

  return {
    userId: null,
    convexToken: token ?? null,
    user: null,
  };
}
