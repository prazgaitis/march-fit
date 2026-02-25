/**
 * Reconstruct a fresh global Response from an upstream fetch() Response.
 *
 * Two problems this solves:
 * 1. Returning the raw undici fetch() Response causes Next.js to emit 500
 *    with empty body on Vercel warm instances (works on cold start, fails
 *    after). Constructing a new global Response avoids the prototype mismatch.
 * 2. `new Response(body, { headers: upstream.headers })` internally does
 *    `new Headers(upstream.headers)`, which joins multi-valued Set-Cookie
 *    into a single `, `-separated string. That corrupts cookies containing
 *    commas in Expires dates (e.g. "Thu, 01 Jan 2026"), breaking session
 *    persistence. We copy Set-Cookie headers individually via getSetCookie().
 */
export async function rebuildResponse(upstream: Response): Promise<Response> {
  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  for (const [name, value] of upstream.headers) {
    if (name.toLowerCase() !== "set-cookie") {
      headers.set(name, value);
    }
  }
  for (const cookie of upstream.headers.getSetCookie()) {
    headers.append("set-cookie", cookie);
  }
  return new Response(body, {
    status: upstream.status,
    headers,
  });
}
