import { type Page, expect } from "@playwright/test";

/**
 * Log an activity via the activity log dialog.
 * Assumes the user is already on a challenge dashboard page.
 */
export async function logActivity(
  page: Page,
  opts: {
    activityName: string;
    metricValue?: string;
  }
) {
  // Open the log dialog - click the first visible "Log activity" button
  const logButton = page
    .getByRole("button", { name: /log activity/i })
    .first();
  await logButton.click();

  // Wait for the dialog to appear
  await expect(page.getByText("Log Activity").first()).toBeVisible({
    timeout: 10_000,
  });

  // Select activity type via combobox
  const combobox = page.getByRole("combobox");
  await combobox.click();

  // Type to search and select the activity
  const searchInput = page.getByPlaceholder(/search activity type/i);
  await searchInput.fill(opts.activityName);

  // Click the matching option
  const option = page
    .getByRole("option", { name: new RegExp(opts.activityName, "i") })
    .first();
  await option.click();

  // Fill metric if needed
  if (opts.metricValue) {
    const metricInput = page.locator("#metric-value");
    await metricInput.waitFor({ state: "visible", timeout: 5_000 });
    await metricInput.fill(opts.metricValue);
  }

  // Submit
  const submitButton = page
    .getByRole("button", { name: /^log activity$/i })
    .last();
  await submitButton.click();

  // Wait for success state
  await expect(
    page.getByText(/activity logged|penalty logged/i).first()
  ).toBeVisible({ timeout: 15_000 });

  // Wait for the dialog to auto-dismiss
  await page.waitForTimeout(4_000);
}
