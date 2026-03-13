import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const getServerAuth = vi.fn();
const setAuth = vi.fn();
const mutation = vi.fn();

vi.mock("@/lib/server-auth", () => ({
  getServerAuth,
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    setAuth,
    mutation,
  })),
}));

async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/strava/callback/route");
}

describe("strava callback route", () => {
  beforeEach(() => {
    getServerAuth.mockReset();
    setAuth.mockReset();
    mutation.mockReset();
    process.env.CONVEX_URL = "https://private.convex.cloud";
    process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID = "12345";
    process.env.STRAVA_CLIENT_SECRET = "secret";
    global.fetch = vi.fn();
  });

  test("redirects unauthenticated users to sign-in", async () => {
    getServerAuth.mockResolvedValue({ userId: null, convexToken: null });

    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest("https://march.fit/api/strava/callback?code=abc"),
    );

    expect(response.headers.get("location")).toBe(
      "https://march.fit/sign-in?redirect_url=/integrations",
    );
  });

  test("rejects requests with mismatched oauth state", async () => {
    getServerAuth.mockResolvedValue({ userId: "user_123", convexToken: null });

    const state = Buffer.from(
      JSON.stringify({
        nonce: "nonce-a",
        successUrl: "/done",
        errorUrl: "/fail",
      }),
    ).toString("base64");

    const request = new NextRequest(
      `https://march.fit/api/strava/callback?code=abc&state=${encodeURIComponent(state)}`,
      {
        headers: {
          cookie: "strava_oauth_state=nonce-b",
        },
      },
    );

    const { GET } = await loadRoute();
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("https://march.fit/fail");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("stores exchanged tokens in Convex and redirects to the success URL", async () => {
    getServerAuth.mockResolvedValue({ userId: "user_123", convexToken: "convex-token" });
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access",
          refresh_token: "refresh",
          expires_at: 123456,
          expires_in: 3600,
          token_type: "Bearer",
          athlete: {
            id: 42,
            username: "runner",
            profile: "https://example.com/profile.png",
          },
        }),
        { status: 200 },
      ),
    );

    const state = Buffer.from(
      JSON.stringify({
        nonce: "nonce-a",
        successUrl: "/done",
        errorUrl: "/fail",
      }),
    ).toString("base64");

    const request = new NextRequest(
      `https://march.fit/api/strava/callback?code=abc&state=${encodeURIComponent(state)}`,
      {
        headers: {
          cookie: "strava_oauth_state=nonce-a",
        },
      },
    );

    const { GET } = await loadRoute();
    const response = await GET(request);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://www.strava.com/oauth/token",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(setAuth).toHaveBeenCalledWith("convex-token");
    expect(mutation).toHaveBeenCalledWith(expect.anything(), {
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: 123456,
      athleteId: 42,
    });
    expect(response.headers.get("location")).toBe("https://march.fit/done");
  });

  test("redirects to the error URL when token exchange fails", async () => {
    getServerAuth.mockResolvedValue({ userId: "user_123", convexToken: null });
    vi.mocked(global.fetch).mockResolvedValue(new Response("bad", { status: 500 }));

    const state = Buffer.from(
      JSON.stringify({
        nonce: "nonce-a",
        successUrl: "/done",
        errorUrl: "/fail",
      }),
    ).toString("base64");

    const request = new NextRequest(
      `https://march.fit/api/strava/callback?code=abc&state=${encodeURIComponent(state)}`,
      {
        headers: {
          cookie: "strava_oauth_state=nonce-a",
        },
      },
    );

    const { GET } = await loadRoute();
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("https://march.fit/fail");
    expect(mutation).not.toHaveBeenCalled();
  });
});
