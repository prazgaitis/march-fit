import { test, expect } from "@playwright/test";
import { signIn } from "../helpers/auth";

/**
 * Strava integration E2E tests.
 *
 * REGRESSION: StravaConnectButton used a Next.js <Link> without prefetch={false}.
 * Next.js auto-prefetches visible Links as RSC requests. API route handlers that
 * return NextResponse.redirect() (not an RSC payload) cause Next.js to throw:
 *   "No response is returned from route handler '...strava/connect/route.ts'"
 * which results in a 500 response for every page that renders the button.
 *
 * Fix: add prefetch={false} to the <Link> in StravaConnectButton.
 * Sentry: https://pauls-web-development.sentry.io/issues/7294280648/
 */

const CHALLENGE_ID = process.env.E2E_MARCH_2026_CHALLENGE_ID!;
const USER_EMAIL =
  process.env.E2E_MARCH_2026_USER_EMAIL ?? "paul@gocomplete.ai";
const PASSWORD = process.env.E2E_USER_PASSWORD!;

test.describe("Strava connect", () => {
  test.skip(
    !CHALLENGE_ID || !PASSWORD,
    "E2E_MARCH_2026_CHALLENGE_ID or E2E_USER_PASSWORD not set"
  );

  test("StravaConnectButton does not trigger RSC prefetch 500 on dashboard", async ({
    page,
  }) => {
    /**
     * FAILING before fix: Next.js prefetches <Link href="/api/strava/connect?...">
     * as an RSC request → server throws "No response is returned from route handler"
     * → 500 response → this assertion fails.
     *
     * PASSING after fix: prefetch={false} prevents the prefetch entirely → no
     * request to /api/strava/connect during page load → assertion passes.
     */
    const stravaConnectErrors: Array<{ status: number; url: string }> = [];

    page.on("response", (response) => {
      if (
        response.url().includes("/api/strava/connect") &&
        response.status() >= 500
      ) {
        stravaConnectErrors.push({
          status: response.status(),
          url: response.url(),
        });
      }
    });

    await signIn(page, { email: USER_EMAIL, password: PASSWORD });

    // The challenge dashboard renders StravaConnectButton inside the onboarding
    // card (visible when Strava is not yet connected). With the buggy code, Next.js
    // will issue a prefetch request to /api/strava/connect as soon as the Link
    // enters the viewport.
    await page.goto(`/challenges/${CHALLENGE_ID}/dashboard`);
    await page.waitForLoadState("networkidle");

    // Give Next.js time to fire any automatic prefetch requests.
    await page.waitForTimeout(3_000);

    expect(
      stravaConnectErrors,
      [
        `Got ${stravaConnectErrors.length} 5xx response(s) to /api/strava/connect.`,
        "Root cause: <Link> auto-prefetches the API route as RSC.",
        "Fix: add prefetch={false} to StravaConnectButton.",
      ].join(" ")
    ).toHaveLength(0);
  });

  test("StravaConnectButton does not trigger RSC prefetch 500 on user profile page", async ({
    page,
  }) => {
    /**
     * The user profile page (/challenges/:id/users/:userId) is where the original
     * Sentry error was captured. It also renders StravaConnectButton as a <Link>.
     */
    const stravaConnectErrors: Array<{ status: number; url: string }> = [];

    page.on("response", (response) => {
      if (
        response.url().includes("/api/strava/connect") &&
        response.status() >= 500
      ) {
        stravaConnectErrors.push({
          status: response.status(),
          url: response.url(),
        });
      }
    });

    await signIn(page, { email: USER_EMAIL, password: PASSWORD });

    // Navigate to the challenge dashboard first to discover our own profile URL.
    await page.goto(`/challenges/${CHALLENGE_ID}/dashboard`);
    await page.waitForLoadState("networkidle");

    // Find a link to the signed-in user's own profile.
    // The dashboard sidebar/nav typically has a "View profile" link.
    const profileLink = page
      .locator('a[href*="/users/"]')
      .filter({ hasText: /profile|view/i })
      .first();

    const directProfileLink = page.locator('a[href*="/users/"]').first();
    const hasProfileLink =
      (await profileLink.isVisible().catch(() => false)) ||
      (await directProfileLink.isVisible().catch(() => false));

    if (!hasProfileLink) {
      test.skip(); // Can't find profile link — skip rather than fail
      return;
    }

    const link = (await profileLink.isVisible().catch(() => false))
      ? profileLink
      : directProfileLink;

    const profileHref = await link.getAttribute("href");
    if (!profileHref) {
      test.skip();
      return;
    }

    // Navigate to the user profile page directly.
    await page.goto(profileHref);
    await page.waitForLoadState("networkidle");

    // Allow time for Next.js prefetch requests to fire.
    await page.waitForTimeout(3_000);

    expect(
      stravaConnectErrors,
      [
        `Got ${stravaConnectErrors.length} 5xx response(s) to /api/strava/connect.`,
        "Root cause: <Link> auto-prefetches the API route as RSC on user profile page.",
        "Fix: add prefetch={false} to StravaConnectButton.",
      ].join(" ")
    ).toHaveLength(0);
  });

  test("clicking Connect Strava initiates redirect to Strava OAuth", async ({
    page,
  }) => {
    await signIn(page, { email: USER_EMAIL, password: PASSWORD });

    await page.goto(`/challenges/${CHALLENGE_ID}/dashboard`);
    await page.waitForLoadState("networkidle");

    // StravaConnectButton wraps a <img> with aria-label="Connect with Strava"
    const connectLink = page
      .getByRole("link", { name: /connect with strava/i })
      .first();

    const isVisible = await connectLink.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(); // Strava already connected for this test account
      return;
    }

    // Block the actual navigation to Strava so the test stays on march.fit.
    let capturedStravaUrl: string | null = null;

    await page.route("https://www.strava.com/**", async (route) => {
      capturedStravaUrl = route.request().url();
      await route.abort("aborted");
    });

    // Click the button — should navigate through /api/strava/connect then
    // redirect to Strava OAuth.
    await connectLink.click();

    // Wait for the Strava redirect to be attempted.
    await page.waitForTimeout(5_000);

    expect(
      capturedStravaUrl,
      "Expected click to redirect to Strava OAuth — got no Strava request"
    ).not.toBeNull();

    expect(capturedStravaUrl).toContain("strava.com/oauth/authorize");
    expect(capturedStravaUrl).toContain("client_id=");
    // Guard against missing NEXT_PUBLIC_STRAVA_CLIENT_ID env var
    expect(capturedStravaUrl).not.toContain("client_id=undefined");
    expect(capturedStravaUrl).toContain("response_type=code");
    expect(capturedStravaUrl).toContain("activity%3Aread_all");
  });

  test("GET /api/strava/connect returns redirect, not 5xx", async ({
    page,
    context,
  }) => {
    /**
     * Directly verifies the API route returns a proper redirect response.
     * Unauthenticated requests should redirect to sign-in (3xx).
     * Authenticated requests should redirect to Strava OAuth (3xx).
     * Neither should return 5xx.
     */

    // Test unauthenticated: should redirect to /sign-in
    const unauthResponse = await context.request.get(
      "/api/strava/connect?successUrl=%2Fintegrations&errorUrl=%2Fintegrations%3Ferror%3Dstrava_auth_failed",
      { maxRedirects: 0 }
    );
    expect(
      unauthResponse.status(),
      "Unauthenticated /api/strava/connect should redirect (3xx), not error"
    ).toBeGreaterThanOrEqual(300);
    expect(unauthResponse.status()).toBeLessThan(500);

    // Test authenticated: should redirect to Strava OAuth
    await signIn(page, { email: USER_EMAIL, password: PASSWORD });

    const authResponse = await context.request.get(
      "/api/strava/connect?successUrl=%2Fintegrations&errorUrl=%2Fintegrations%3Ferror%3Dstrava_auth_failed",
      { maxRedirects: 0 }
    );
    expect(
      authResponse.status(),
      "Authenticated /api/strava/connect should redirect to Strava OAuth (3xx), not error"
    ).toBeGreaterThanOrEqual(300);
    expect(authResponse.status()).toBeLessThan(500);

    const location = authResponse.headers()["location"] ?? "";
    expect(
      location,
      "Redirect should point to Strava OAuth, not an error page"
    ).toContain("strava.com/oauth/authorize");
    expect(location).not.toContain("client_id=undefined");
  });
});
