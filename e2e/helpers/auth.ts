import { type Page, expect } from "@playwright/test";

/**
 * Sign up a new user via the /sign-up form.
 * Returns after the page has navigated away from sign-up (usually to /challenges).
 */
export async function signUp(
  page: Page,
  opts: { name: string; email: string; password: string }
) {
  await page.goto("/sign-up");
  await page.waitForLoadState("networkidle");

  // Wait for the sign-up form to be ready
  await expect(
    page.getByRole("heading", { name: /create your account/i })
  ).toBeVisible();

  await page.getByPlaceholder("Your name").fill(opts.name);
  await page.getByPlaceholder("you@example.com").fill(opts.email);
  await page.getByPlaceholder("Min. 8 characters").fill(opts.password);
  await page.getByRole("button", { name: /create account/i }).click();

  // Wait for navigation away from sign-up
  await page.waitForURL((url) => !url.pathname.includes("/sign-up"), {
    timeout: 30_000,
  });
}

/**
 * Sign in an existing user via /sign-in.
 * Returns after the page has navigated away from sign-in.
 * Throws if sign-in fails.
 */
export async function signIn(
  page: Page,
  opts: { email: string; password: string }
) {
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");

  // Wait for the sign-in form to be ready
  await expect(
    page.getByRole("heading", { name: /welcome back/i })
  ).toBeVisible();

  await page.getByPlaceholder("you@example.com").fill(opts.email);
  await page.getByPlaceholder("Your password").fill(opts.password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for navigation away from sign-in
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"), {
    timeout: 30_000,
  });
}

/**
 * Try to sign in. Returns true if successful, false if credentials are invalid.
 * Does not throw on expected auth failures (wrong password, user not found).
 */
export async function trySignIn(
  page: Page,
  opts: { email: string; password: string }
): Promise<boolean> {
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("heading", { name: /welcome back/i })
  ).toBeVisible();

  await page.getByPlaceholder("you@example.com").fill(opts.email);
  await page.getByPlaceholder("Your password").fill(opts.password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Race: either we navigate away (success) or an error message appears
  const result = await Promise.race([
    page
      .waitForURL((url) => !url.pathname.includes("/sign-in"), {
        timeout: 15_000,
      })
      .then(() => true),
    page
      .getByText(/incorrect email|no account found|something went wrong/i)
      .first()
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => false),
  ]);

  return result;
}
