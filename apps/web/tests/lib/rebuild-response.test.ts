import { describe, it, expect } from "vitest";
import { rebuildResponse } from "@/lib/rebuild-response";

/**
 * Tests for rebuildResponse — the function that reconstructs a global Response
 * from an upstream fetch() Response.
 *
 * These guard against two regressions that have each caused production outages:
 *
 * 1. Set-Cookie corruption (PRs #81, #97 → reverted in #98):
 *    `new Headers(upstream.headers)` joins multi-valued Set-Cookie into one
 *    comma-separated string, breaking cookies with commas in Expires dates.
 *
 * 2. Warm-instance 500s (PRs #98, #104):
 *    Returning the raw undici fetch() Response causes Next.js to emit 500
 *    with empty body on Vercel warm instances.
 */
describe("rebuildResponse", () => {
  it("preserves multiple Set-Cookie headers individually", async () => {
    // Auth flows can set multiple cookies in one response (session, JWT, cache).
    const upstream = new Response('{"ok":true}', {
      status: 200,
      headers: [
        ["content-type", "application/json"],
        [
          "set-cookie",
          "__Secure-auth.session_token=abc123; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 2026 00:00:00 GMT",
        ],
        [
          "set-cookie",
          "__Secure-auth.convex_jwt=eyJhbGc; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=Lax",
        ],
        [
          "set-cookie",
          "__Secure-auth.session_data=xyz; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=Lax",
        ],
      ],
    });

    const result = await rebuildResponse(upstream);
    const cookies = result.headers.getSetCookie();

    expect(cookies).toHaveLength(3);
    expect(cookies[0]).toContain("session_token=abc123");
    expect(cookies[1]).toContain("convex_jwt=eyJhbGc");
    expect(cookies[2]).toContain("session_data=xyz");
  });

  it("does not corrupt Set-Cookie Expires containing commas", async () => {
    // The comma in "Thu, 01 Jan 2026" is the exact thing that breaks when
    // Set-Cookie headers get joined with `, `
    const expiresDate = "Thu, 01 Jan 2026 00:00:00 GMT";
    const upstream = new Response(null, {
      status: 200,
      headers: [
        [
          "set-cookie",
          `token=abc; Expires=${expiresDate}; Path=/; HttpOnly; Secure`,
        ],
      ],
    });

    const result = await rebuildResponse(upstream);
    const cookies = result.headers.getSetCookie();

    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toContain(`Expires=${expiresDate}`);
  });

  it("returns a proper global Response instance", async () => {
    const upstream = new Response("hello", { status: 200 });
    const result = await rebuildResponse(upstream);

    expect(result).toBeInstanceOf(Response);
  });

  it("preserves status code", async () => {
    const upstream = new Response('{"error":"bad"}', { status: 401 });
    const result = await rebuildResponse(upstream);

    expect(result.status).toBe(401);
  });

  it("preserves body content", async () => {
    const body = JSON.stringify({ url: "https://accounts.google.com/...", redirect: true });
    const upstream = new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    const result = await rebuildResponse(upstream);
    const text = await result.text();

    expect(text).toBe(body);
  });

  it("preserves non-cookie headers", async () => {
    const upstream = new Response(null, {
      status: 302,
      headers: [
        ["location", "https://accounts.google.com/o/oauth2/v2/auth?..."],
        ["content-type", "application/json"],
        ["x-custom", "value"],
      ],
    });

    const result = await rebuildResponse(upstream);

    expect(result.headers.get("location")).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth?..."
    );
    expect(result.headers.get("content-type")).toBe("application/json");
    expect(result.headers.get("x-custom")).toBe("value");
  });

  it("works correctly on repeated calls (simulating warm instance reuse)", async () => {
    // The warm-instance bug only manifested after the first request.
    // This test verifies the function works identically on call N+1.
    for (let i = 0; i < 5; i++) {
      const upstream = new Response(`{"call":${i}}`, {
        status: 200,
        headers: [
          ["content-type", "application/json"],
          [
            "set-cookie",
            `session=val${i}; Path=/; HttpOnly; Secure; Expires=Thu, 01 Jan 2026 00:00:00 GMT`,
          ],
        ],
      });

      const result = await rebuildResponse(upstream);

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(200);
      expect(await result.text()).toBe(`{"call":${i}}`);

      const cookies = result.headers.getSetCookie();
      expect(cookies).toHaveLength(1);
      expect(cookies[0]).toContain(`session=val${i}`);
    }
  });

  it("handles response with no Set-Cookie headers", async () => {
    const upstream = new Response("null", {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    const result = await rebuildResponse(upstream);

    expect(result.headers.getSetCookie()).toHaveLength(0);
    expect(await result.text()).toBe("null");
  });
});
