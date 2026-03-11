import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const rebuildResponse = vi.fn();
const convexBetterAuthNextJs = vi.fn();

vi.mock("@/lib/rebuild-response", () => ({
  rebuildResponse,
}));

vi.mock("@convex-dev/better-auth/nextjs", () => ({
  convexBetterAuthNextJs,
}));

const ORIGINAL_ENV = { ...process.env };

async function loadServerAuth() {
  vi.resetModules();
  return import("@/lib/server-auth");
}

describe("server auth proxy", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    rebuildResponse.mockReset();
    convexBetterAuthNextJs.mockReset();
    convexBetterAuthNextJs.mockReturnValue({
      isAuthenticated: vi.fn(),
      getToken: vi.fn(),
      preloadAuthQuery: vi.fn(),
      fetchAuthQuery: vi.fn(),
      fetchAuthMutation: vi.fn(),
      fetchAuthAction: vi.fn(),
    });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  test("GET proxy forwards to private convex site URL", async () => {
    process.env.CONVEX_URL = "https://private.convex.cloud";
    process.env.CONVEX_SITE_URL = "https://private.convex.site";

    const upstream = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const rebuilt = new Response(JSON.stringify({ proxied: true }), { status: 200 });
    vi.mocked(global.fetch).mockResolvedValue(upstream);
    rebuildResponse.mockResolvedValue(rebuilt);

    const { betterAuthHandler } = await loadServerAuth();
    const response = await betterAuthHandler.GET(
      new Request("https://march.fit/api/auth/session?foo=bar", {
        headers: {
          cookie: "session=abc",
        },
      }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://private.convex.site/api/auth/session?foo=bar",
      expect.objectContaining({
        method: "GET",
        redirect: "manual",
        headers: expect.any(Headers),
      }),
    );

    const forwardedHeaders = vi.mocked(global.fetch).mock.calls[0]?.[1]?.headers as Headers;
    expect(forwardedHeaders.get("host")).toBe("private.convex.site");
    expect(response).toBe(rebuilt);
  });

  test("POST proxy forwards request body and rebuilds upstream response", async () => {
    process.env.CONVEX_URL = "https://private.convex.cloud";

    const upstream = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const rebuilt = new Response(JSON.stringify({ proxied: true }), { status: 200 });
    vi.mocked(global.fetch).mockResolvedValue(upstream);
    rebuildResponse.mockResolvedValue(rebuilt);

    const { betterAuthHandler } = await loadServerAuth();
    await betterAuthHandler.POST(
      new Request("https://march.fit/api/auth/callback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ hello: "world" }),
      }),
    );

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    expect(options?.method).toBe("POST");
    expect(options?.body).toBeInstanceOf(ArrayBuffer);
    expect(rebuildResponse).toHaveBeenCalledWith(upstream);
  });

  test("returns 500 when convex configuration is missing", async () => {
    delete process.env.CONVEX_URL;
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    delete process.env.CONVEX_SITE_URL;
    delete process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

    const { betterAuthHandler } = await loadServerAuth();
    const response = await betterAuthHandler.GET(
      new Request("https://march.fit/api/auth/session"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
