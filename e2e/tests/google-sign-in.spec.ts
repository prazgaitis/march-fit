import { test, expect } from "@playwright/test";

test.describe("Google Sign-In", () => {
  test("sign-in page renders with Google button", async ({ page }) => {
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");

    // Page should show "Welcome back" heading
    await expect(
      page.getByRole("heading", { name: /welcome back/i })
    ).toBeVisible();

    // Google button should be present
    const googleButton = page.getByRole("button", {
      name: /continue with google/i,
    });
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toBeEnabled();

    // Email and password fields should be present
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByPlaceholder("Your password")).toBeVisible();

    // Sign-in button should be present
    await expect(
      page.getByRole("button", { name: /^sign in$/i })
    ).toBeVisible();

    // Sign-up link should be present
    await expect(page.getByRole("link", { name: /sign up/i })).toBeVisible();
  });

  test("clicking Google sign-in redirects to Google OAuth", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");

    // Wait for the page to be interactive
    const googleButton = page.getByRole("button", {
      name: /continue with google/i,
    });
    await expect(googleButton).toBeVisible();

    // Click the Google button and expect navigation away from our domain.
    // We catch the navigation because Google may block or redirect bots.
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/auth") ||
          resp.url().includes("accounts.google.com"),
        { timeout: 15_000 }
      ),
      googleButton.click(),
    ]);

    // The response should indicate a redirect toward Google OAuth
    // or at least that our auth endpoint was called
    expect(response.status()).toBeLessThan(500);
    await page.waitForURL(/accounts\.google\.com/, { timeout: 15_000 });
  });

  test("sign-up page renders correctly", async ({ page }) => {
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /create your account/i })
    ).toBeVisible();

    // All form fields should be present
    await expect(page.getByPlaceholder("Your name")).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByPlaceholder("Min. 8 characters")).toBeVisible();

    // Google button should be present on sign-up too
    await expect(
      page.getByRole("button", { name: /continue with google/i })
    ).toBeVisible();

    // Create account button
    await expect(
      page.getByRole("button", { name: /create account/i })
    ).toBeVisible();
  });
});
