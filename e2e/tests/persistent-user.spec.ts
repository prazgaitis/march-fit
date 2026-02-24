import { test, expect } from "@playwright/test";
import { signIn, signUp, trySignIn } from "../helpers/auth";
import { logActivity } from "../helpers/activity";

const CHALLENGE_ID = process.env.E2E_CHALLENGE_ID!;
const INVITE_CODE = process.env.E2E_CHALLENGE_INVITE_CODE!;
const PASSWORD = process.env.E2E_USER_PASSWORD ?? "e2e-test-password-123";

/**
 * Persistent test users. These users are created once (on first run) and
 * reused every night. Each run logs additional activities, so their point
 * totals grow over time.
 */
const PERSISTENT_USERS = [
  {
    email: "e2e-runner@test.march.fit",
    name: "E2E Runner",
    activity: { activityName: "E2E Run", metricValue: "2" }, // 20 pts/run
  },
  {
    email: "e2e-athlete@test.march.fit",
    name: "E2E Athlete",
    activity: { activityName: "E2E Workout", metricValue: "30" }, // 30 pts/workout
  },
  {
    email: "e2e-completionist@test.march.fit",
    name: "E2E Completionist",
    activity: { activityName: "E2E Completion" }, // 25 pts/completion
  },
];

test.describe("Persistent user flows", () => {
  test.skip(!CHALLENGE_ID, "E2E_CHALLENGE_ID not set");
  test.skip(!INVITE_CODE, "E2E_CHALLENGE_INVITE_CODE not set");

  for (const user of PERSISTENT_USERS) {
    test(`${user.name}: sign in, log activity, verify progress`, async ({
      page,
    }) => {
      // -----------------------------------------------------------
      // 1. Try to sign in; if it fails, sign up first
      // -----------------------------------------------------------
      const signedIn = await trySignIn(page, {
        email: user.email,
        password: PASSWORD,
      });

      if (!signedIn) {
        // Create the user
        await signUp(page, {
          name: user.name,
          email: user.email,
          password: PASSWORD,
        });

        // After sign-up, navigate to invite page to join the challenge
        await page.goto(
          `/challenges/${CHALLENGE_ID}/invite/${INVITE_CODE}`
        );
        await page.waitForLoadState("networkidle");

        // Wait for the page to recognize we're signed in
        const joinButton = page.getByRole("button", {
          name: /join challenge/i,
        });

        // If we see "Join Challenge", click it
        const isJoinVisible = await joinButton
          .isVisible()
          .catch(() => false);
        if (isJoinVisible) {
          await joinButton.click();
          await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
        } else {
          // May already be joined or redirected
          await page.goto(
            `/challenges/${CHALLENGE_ID}/dashboard`
          );
        }
        await page.waitForLoadState("networkidle");
      }

      // -----------------------------------------------------------
      // 2. Navigate to the challenge dashboard
      // -----------------------------------------------------------
      if (!page.url().includes(`/challenges/${CHALLENGE_ID}/dashboard`)) {
        await page.goto(
          `/challenges/${CHALLENGE_ID}/dashboard`
        );
        await page.waitForLoadState("networkidle");
      }

      // Verify we're on the dashboard
      await expect(page.getByText(/total points/i).first()).toBeVisible({
        timeout: 15_000,
      });

      // -----------------------------------------------------------
      // 3. Read current point total from the sidebar before logging
      // -----------------------------------------------------------
      const pointsTextBefore = await page
        .getByText(/total points/i)
        .first()
        .textContent();
      const pointsBefore = extractPoints(pointsTextBefore);

      // -----------------------------------------------------------
      // 4. Log the user's assigned activity
      // -----------------------------------------------------------
      await logActivity(page, user.activity);

      // -----------------------------------------------------------
      // 5. Verify the point total increased
      // -----------------------------------------------------------
      // Reload the dashboard to get fresh data
      await page.goto(
        `/challenges/${CHALLENGE_ID}/dashboard`
      );
      await page.waitForLoadState("networkidle");

      await expect(page.getByText(/total points/i).first()).toBeVisible({
        timeout: 15_000,
      });

      const pointsTextAfter = await page
        .getByText(/total points/i)
        .first()
        .textContent();
      const pointsAfter = extractPoints(pointsTextAfter);

      // Points should have increased (or at minimum not decreased)
      expect(pointsAfter).toBeGreaterThan(pointsBefore);

      // -----------------------------------------------------------
      // 6. Navigate to leaderboard and verify user appears
      // -----------------------------------------------------------
      await page.goto(
        `/challenges/${CHALLENGE_ID}/leaderboard`
      );
      await page.waitForLoadState("networkidle");

      // User should appear on the leaderboard
      await expect(page.getByText(user.name).first()).toBeVisible({
        timeout: 15_000,
      });

      // Leaderboard should show their updated points
      const userRow = page.locator("a").filter({ hasText: user.name });
      await expect(userRow.first()).toBeVisible();

      // The row should contain the updated point total
      await expect(
        userRow.first().getByText(String(pointsAfter))
      ).toBeVisible({ timeout: 10_000 });
    });
  }

  test("leaderboard shows all persistent users ranked correctly", async ({
    page,
  }) => {
    // Sign in as first persistent user to view leaderboard
    await signIn(page, {
      email: PERSISTENT_USERS[0].email,
      password: PASSWORD,
    });

    await page.goto(
      `/challenges/${CHALLENGE_ID}/leaderboard`
    );
    await page.waitForLoadState("networkidle");

    // All persistent users should appear
    for (const user of PERSISTENT_USERS) {
      await expect(page.getByText(user.name).first()).toBeVisible({
        timeout: 15_000,
      });
    }

    // Verify entries are sorted by points descending
    const rows = page.locator("a[href*='/users/']");
    const count = await rows.count();

    let previousPoints = Infinity;
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const pointsText = await row
        .locator("text=points")
        .first()
        .evaluate((el) => el.parentElement?.textContent ?? "");
      const points = extractPoints(pointsText);

      // Each entry's points should be <= the previous entry's points
      expect(points).toBeLessThanOrEqual(previousPoints);
      previousPoints = points;
    }
  });
});

/**
 * Extract numeric points from text like "75 total points" or "75".
 */
function extractPoints(text: string | null): number {
  if (!text) return 0;
  const match = text.match(/([\d,]+)\s*total points/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ""), 10);
  }
  // Fallback: find the first number in the text
  const numMatch = text.match(/([\d,]+)/);
  return numMatch ? parseInt(numMatch[1].replace(/,/g, ""), 10) : 0;
}
