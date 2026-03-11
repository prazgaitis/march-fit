import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const getServerAuth = vi.fn();

vi.mock("@/lib/server-auth", () => ({
  getServerAuth,
}));

async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/strava/connect/route");
}

describe("strava connect route", () => {
  beforeEach(() => {
    getServerAuth.mockReset();
    process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID = "12345";
  });

  test("redirects unauthenticated users to sign-in", async () => {
    getServerAuth.mockResolvedValue({ userId: null });

    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest("https://march.fit/api/strava/connect"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://march.fit/sign-in?redirect_url=/integrations",
    );
  });

  test("redirects authenticated users to Strava with sanitized callback state", async () => {
    getServerAuth.mockResolvedValue({ userId: "user_123" });

    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest(
        "https://march.fit/api/strava/connect?successUrl=/done&errorUrl=https://evil.example",
      ),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("https://www.strava.com/oauth/authorize?");
    expect(location).toContain("client_id=12345");
    expect(location).toContain(
      "redirect_uri=https%3A%2F%2Fmarch.fit%2Fapi%2Fstrava%2Fcallback",
    );

    const authUrl = new URL(location!);
    const state = authUrl.searchParams.get("state");
    expect(state).toBeTruthy();

    const parsedState = JSON.parse(Buffer.from(state!, "base64").toString("utf8")) as {
      nonce: string;
      successUrl: string;
      errorUrl: string;
    };
    expect(parsedState.successUrl).toBe("/done");
    expect(parsedState.errorUrl).toBe("/integrations?error=strava_auth_failed");

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("strava_oauth_state=");
    expect(setCookie).toContain("HttpOnly");
  });
});
