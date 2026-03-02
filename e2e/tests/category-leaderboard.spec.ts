import { test, expect } from "@playwright/test";
import { signIn } from "../helpers/auth";

const CHALLENGE_ID = process.env.E2E_CATEGORY_LEADERBOARD_CHALLENGE_ID!;
const USER_EMAIL = process.env.E2E_MARCH_2026_USER_EMAIL!;
const PASSWORD = process.env.E2E_USER_PASSWORD ?? "e2e-test-password-123";

/**
 * Read-only tests against a production challenge with category data.
 * These verify the cumulative category leaderboard renders correctly,
 * exercising the optimized query from PR #90.
 *
 * Uses an existing user who is already a participant — no writes.
 */
test.describe("Category leaderboard", () => {
  test.skip(
    !CHALLENGE_ID,
    "E2E_CATEGORY_LEADERBOARD_CHALLENGE_ID not set"
  );
  test.skip(!USER_EMAIL, "E2E_MARCH_2026_USER_EMAIL not set");

  test("cumulative category leaderboard loads with data", async ({
    page,
  }) => {
    await signIn(page, {
      email: USER_EMAIL,
      password: PASSWORD,
    });

    // Navigate to the leaderboard
    await page.goto(`/challenges/${CHALLENGE_ID}/leaderboard`);
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
    await expect(page.locator(".animate-spin")).toBeHidden({
      timeout: 30_000,
    });

    // The challenge has logged activities with categories — "No activities yet"
    // would mean the query failed or returned empty.
    const noActivities = page.getByText("No activities yet");
    await expect(noActivities).toBeHidden({ timeout: 15_000 });

    // At least one gender column should be visible
    await expect(page.getByText("Men's / Open").first()).toBeVisible({
      timeout: 15_000,
    });

    // There should be multiple category sections
    const categoryHeadings = page.locator(
      "h3.text-sm.font-semibold.uppercase"
    );
    const count = await categoryHeadings.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
