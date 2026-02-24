import { test, expect } from "@playwright/test";
import {
  expectSessionState,
  signIn,
  signOut,
  signUp,
} from "../helpers/auth";

const PASSWORD = process.env.E2E_USER_PASSWORD ?? "e2e-test-password-123";

test.describe("Authentication session flows", () => {
  test("user can sign up, sign out, sign in again, and sign out", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const email = `e2e-auth-${timestamp}@test.march.fit`;
    const name = `E2E Auth ${timestamp}`;

    await signUp(page, { name, email, password: PASSWORD });
    await expectSessionState(page, "authenticated");

    await signOut(page);
    await expectSessionState(page, "anonymous");

    await page.goto("/sign-in");
    await expect(
      page.getByRole("heading", { name: /welcome back/i })
    ).toBeVisible();

    await signIn(page, { email, password: PASSWORD });
    await expectSessionState(page, "authenticated");

    await signOut(page);
    await expectSessionState(page, "anonymous");
  });
});
