import { test, expect } from "@playwright/test";
import { signIn } from "../helpers/auth";

const MARCH_2026_CHALLENGE_ID = process.env.E2E_MARCH_2026_CHALLENGE_ID!;
const MARCH_2026_USER_EMAIL = process.env.E2E_MARCH_2026_USER_EMAIL!;
const PASSWORD = process.env.E2E_USER_PASSWORD ?? "e2e-test-password-123";

/**
 * Read-only tests against the March 2026 production challenge.
 * These verify pages that require real data volume to exercise
 * backend query limits (e.g. the 16MB bytes-read fix in PR #90).
 *
 * Uses an existing user who is already a participant — no writes.
 */
test.describe("Category leaderboard (March 2026)", () => {
  test.skip(
    !MARCH_2026_CHALLENGE_ID,
    "E2E_MARCH_2026_CHALLENGE_ID not set"
  );
  test.skip(
    !MARCH_2026_USER_EMAIL,
    "E2E_MARCH_2026_USER_EMAIL not set"
  );

  test("cumulative category leaderboard loads with data", async ({
    page,
  }) => {
    await signIn(page, {
      email: MARCH_2026_USER_EMAIL,
      password: PASSWORD,
    });

    // Navigate to the leaderboard
    await page.goto(
      `/challenges/${MARCH_2026_CHALLENGE_ID}/leaderboard`
    );
    await page.waitForLoadState("networkidle");

    // Overall leaderboard should render
    await expect(page.getByText(/leaderboard/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // Click the "Cumulative by Category" tab
    const cumulativeTab = page.getByRole("button", {
      name: /cumulative by category/i,
    });
    await expect(cumulativeTab).toBeVisible();
    await cumulativeTab.click();

    // Wait for loading to settle
    await expect(page.locator(".animate-spin")).toBeHidden({ timeout: 30_000 });

    // Before PR #90, the getCumulativeCategoryLeaderboard query exceeds
    // the 16MB bytes-read limit on large challenges. Convex returns an
    // error, and the component falls through to the "No activities yet"
    // empty state. After the fix, real category data renders.
    const noActivities = page.getByText("No activities yet");
    const womenColumn = page.getByText("Women's").first();

    // The challenge has hundreds of logged activities — "No activities yet"
    // means the query failed silently (the PR #90 bug).
    await expect(noActivities).toBeHidden({ timeout: 15_000 });
    await expect(womenColumn).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Men's / Open").first()).toBeVisible();

    // There should be multiple category sections (March 2026 has 7+ categories)
    const categoryHeadings = page.locator(
      "h3.text-sm.font-semibold.uppercase"
    );
    const count = await categoryHeadings.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
