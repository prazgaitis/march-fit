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

function getRequestPath(req: Request): string {
  try {
    return new URL(req.url).pathname;
  } catch {
    return "<invalid-url>";
  }
}

/**
 * Custom auth proxy handler that forwards requests to the Convex site URL.
 *
 * The library's built-in handler uses `new Request(url, originalRequest)` to
 * clone the request, which fails on Node 25+ with "expected non-null body
 * source" because the body ReadableStream cannot be cloned that way.
 * See: https://github.com/get-convex/better-auth/issues/274
 *
 * This handler explicitly reads the body and constructs a new fetch call,
 * returning the upstream Response directly to preserve Set-Cookie headers.
 */
function proxyHandler(method: "GET" | "POST") {
  return async (req: Request): Promise<Response> => {
    const path = getRequestPath(req);
    try {
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
      if (!convexUrl) {
        throw new Error("NEXT_PUBLIC_CONVEX_URL is not set.");
      }
      const siteUrl = resolveConvexSiteUrl(convexUrl);

      const requestUrl = new URL(req.url);
      const targetUrl = `${siteUrl}${requestUrl.pathname}${requestUrl.search}`;

      // Read body explicitly to avoid ReadableStream cloning issues
      const body = method === "POST" ? await req.arrayBuffer() : undefined;

      const headers = new Headers(req.headers);
      // Use "identity" so the upstream sends uncompressed data — we buffer the
      // response body below and don't want to deal with decompression mismatch.
      headers.set("accept-encoding", "identity");
      headers.set("host", new URL(siteUrl).host);

      const upstream = await fetch(targetUrl, {
        method,
        headers,
        body,
        redirect: "manual",
      });

      // Buffer the full response body before constructing the return value.
      //
      // Returning the raw fetch() Response (whose body is an undici
      // ReadableStream) can cause Next.js / Turbopack to report
      // "No response is returned from route handler" when the stream is piped
      // through the route handler infrastructure.  Reading into an ArrayBuffer
      // first sidesteps the streaming issue and guarantees we hand back a
      // self-contained Response that Next.js can always serialise.
      const upstreamBody = await upstream.arrayBuffer();

      const responseHeaders = new Headers(upstream.headers);
      // fetch() transparently decompresses gzip/br, so strip the
      // content-encoding header to avoid double-decompression on the client.
      responseHeaders.delete("content-encoding");
      responseHeaders.delete("transfer-encoding");
      if (upstreamBody.byteLength > 0) {
        responseHeaders.set("content-length", String(upstreamBody.byteLength));
      }

      return new Response(upstreamBody.byteLength > 0 ? upstreamBody : null, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error(`[server-auth] ${method} proxy threw`, {
        path,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  };
}

export const betterAuthHandler = {
  GET: proxyHandler("GET"),
  POST: proxyHandler("POST"),
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
