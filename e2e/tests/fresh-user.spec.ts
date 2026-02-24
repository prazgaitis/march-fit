import { test, expect } from "@playwright/test";
import { signUp } from "../helpers/auth";
import { logActivity } from "../helpers/activity";

const CHALLENGE_ID = process.env.E2E_CHALLENGE_ID!;
const INVITE_CODE = process.env.E2E_CHALLENGE_INVITE_CODE!;
const PASSWORD = process.env.E2E_USER_PASSWORD ?? "e2e-test-password-123";

test.describe("Fresh user flow", () => {
  test.skip(!CHALLENGE_ID, "E2E_CHALLENGE_ID not set");
  test.skip(!INVITE_CODE, "E2E_CHALLENGE_INVITE_CODE not set");

  const timestamp = Date.now();
  const email = `e2e-fresh-${timestamp}@test.march.fit`;
  const name = `E2E Fresh ${timestamp}`;

  test("sign up, join challenge, log activities, verify leaderboard", async ({
    page,
  }) => {
    // -----------------------------------------------------------
    // 1. Navigate to the invite page (unauthenticated)
    // -----------------------------------------------------------
    await page.goto(
      `/challenges/${CHALLENGE_ID}/invite/${INVITE_CODE}`
    );
    await page.waitForLoadState("networkidle");

    // The invite page should show the challenge name and a CTA
    await expect(
      page.getByText(/e2e test challenge/i).first()
    ).toBeVisible({ timeout: 15_000 });

    // Since we're not signed in, it should show "Sign Up to Join"
    const signUpLink = page.getByRole("link", {
      name: /sign up to join/i,
    });
    await expect(signUpLink).toBeVisible();

    // -----------------------------------------------------------
    // 2. Sign up via the link (which includes redirect_url back to invite)
    // -----------------------------------------------------------
    await signUpLink.click();
    await page.waitForURL(/\/sign-up/, { timeout: 10_000 });

    // Fill out sign-up form
    await expect(
      page.getByRole("heading", { name: /create your account/i })
    ).toBeVisible();

    await page.getByPlaceholder("Your name").fill(name);
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("Min. 8 characters").fill(PASSWORD);
    await page.getByRole("button", { name: /create account/i }).click();

    // After sign-up, we should be redirected back to the invite page
    await page.waitForURL(/\/invite\//, { timeout: 30_000 });
    await page.waitForLoadState("networkidle");

    // -----------------------------------------------------------
    // 3. Join the challenge
    // -----------------------------------------------------------
    // Now signed in, the CTA should show "Join Challenge"
    const joinButton = page.getByRole("button", {
      name: /join challenge/i,
    });
    await expect(joinButton).toBeVisible({ timeout: 15_000 });
    await joinButton.click();

    // Should redirect to the dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await page.waitForLoadState("networkidle");

    // -----------------------------------------------------------
    // 4. Verify dashboard loaded
    // -----------------------------------------------------------
    // Should see "total points" in the sidebar (or on mobile in a card)
    await expect(page.getByText(/total points/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // -----------------------------------------------------------
    // 5. Log first activity: E2E Run (3 miles = 30 points)
    // -----------------------------------------------------------
    await logActivity(page, {
      activityName: "E2E Run",
      metricValue: "3",
    });

    // -----------------------------------------------------------
    // 6. Log second activity: E2E Workout (20 minutes = 20 points)
    // -----------------------------------------------------------
    await logActivity(page, {
      activityName: "E2E Workout",
      metricValue: "20",
    });

    // -----------------------------------------------------------
    // 7. Log third activity: E2E Completion (25 fixed points)
    // -----------------------------------------------------------
    await logActivity(page, {
      activityName: "E2E Completion",
    });

    // Total expected: 30 + 20 + 25 = 75 points

    // -----------------------------------------------------------
    // 8. Navigate to leaderboard and verify points
    // -----------------------------------------------------------
    await page.goto(
      `/challenges/${CHALLENGE_ID}/leaderboard`
    );
    await page.waitForLoadState("networkidle");

    // The user's name should appear on the leaderboard
    await expect(page.getByText(name).first()).toBeVisible({
      timeout: 15_000,
    });

    // Find the leaderboard row containing the user name and verify points
    const userRow = page
      .locator("a")
      .filter({ hasText: name });
    await expect(userRow.first()).toBeVisible();

    // The row should contain "75" (the total points)
    await expect(userRow.first().getByText("75")).toBeVisible();
  });
});
