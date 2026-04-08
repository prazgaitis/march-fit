import { NextRequest } from "next/server";
import { getServerConvexSiteUrl } from "@/lib/server-convex-env";

/**
 * Catch-all proxy: forwards /api/v1/* requests to the Convex HTTP API.
 *
 * This lets clients use the main domain (e.g. march.fit/api/v1/me)
 * instead of needing the Convex site URL directly.
 */
async function proxyToConvex(request: NextRequest) {
  const convexSiteUrl = getServerConvexSiteUrl();
  const url = new URL(request.url);
  const targetUrl = `${convexSiteUrl}${url.pathname}${url.search}`;

  const headers = new Headers();
  // Forward auth and content-type headers
  const auth = request.headers.get("Authorization");
  if (auth) headers.set("Authorization", auth);
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);

  const res = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD"
      ? await request.text()
      : undefined,
  });

  // Forward the response, stripping hop-by-hop / encoding headers.
  // fetch() auto-decompresses but keeps the original Content-Encoding header,
  // which causes ERR_CONTENT_DECODING_FAILED if forwarded as-is.
  const responseHeaders = new Headers(res.headers);
  responseHeaders.delete("Content-Encoding");
  responseHeaders.delete("Content-Length");
  responseHeaders.delete("Transfer-Encoding");
  responseHeaders.set("Access-Control-Allow-Origin", "*");

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxyToConvex;
export const POST = proxyToConvex;
export const PUT = proxyToConvex;
export const PATCH = proxyToConvex;
export const DELETE = proxyToConvex;

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
