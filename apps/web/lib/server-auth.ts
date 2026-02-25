import "server-only";

import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { FunctionReference, OptionalRestArgs } from "convex/server";
import { Preloaded } from "convex/react";

import { api } from "@repo/backend";

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

// Lazy initialization to avoid build-time errors when env vars aren't available
let _betterAuthUtils: ReturnType<typeof convexBetterAuthNextJs> | null = null;

function resolveConvexSiteUrl(convexUrl: string): string {
  if (process.env.NEXT_PUBLIC_CONVEX_SITE_URL) {
    return process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  }

  // Convex cloud deployments use a corresponding ".convex.site" host for auth.
  if (convexUrl.includes(".convex.cloud")) {
    return convexUrl.replace(".convex.cloud", ".convex.site");
  }

  // For self-hosted or already-site URLs, reuse the same host.
  return convexUrl;
}

function getBetterAuthUtils() {
  if (!_betterAuthUtils) {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not set.");
    }

    _betterAuthUtils = convexBetterAuthNextJs({
      convexUrl,
      convexSiteUrl: resolveConvexSiteUrl(convexUrl),
    });
  }
  return _betterAuthUtils;
}

/**
 * Auth route handler — delegates to the library's built-in proxy.
 *
 * The library handler is patched (see patches/@convex-dev__better-auth) to fix
 * a Node 25+ crash where `new Request(url, req)` fails because the body
 * ReadableStream cannot be cloned. The patch reads the body explicitly and
 * returns the upstream fetch() Response directly, preserving Set-Cookie headers.
 *
 * Lazy wrappers keep env-var resolution deferred until request time so the
 * module can be imported during static builds when NEXT_PUBLIC_CONVEX_URL
 * is not yet available.
 */
export const betterAuthHandler = {
  GET: (req: Request) => getBetterAuthUtils().handler.GET(req),
  POST: (req: Request) => getBetterAuthUtils().handler.POST(req),
};

export async function isAuthenticated() {
  return getBetterAuthUtils().isAuthenticated();
}

export async function getToken() {
  return getBetterAuthUtils().getToken();
}

export async function preloadAuthQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgs<Query>
): Promise<Preloaded<Query>> {
  return getBetterAuthUtils().preloadAuthQuery(query, ...args);
}

export async function fetchAuthQuery<T>(query: any, args: Record<string, unknown>): Promise<T> {
  return getBetterAuthUtils().fetchAuthQuery(query, args);
}

export async function fetchAuthMutation<T>(mutation: any, args: Record<string, unknown>): Promise<T> {
  return getBetterAuthUtils().fetchAuthMutation(mutation, args);
}

export async function fetchAuthAction<T>(action: any, args: Record<string, unknown>): Promise<T> {
  return getBetterAuthUtils().fetchAuthAction(action, args);
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
