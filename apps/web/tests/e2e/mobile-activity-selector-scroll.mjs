#!/usr/bin/env node

import { chromium, devices } from "playwright";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "https://www.march.fit";
const CHALLENGE_ID =
  process.env.PLAYWRIGHT_CHALLENGE_ID ?? "js79t7qjg4sdehecxyngd3jjcs810wp1";
const PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "Playwright!23456";
const CHALLENGE_URL = `${BASE_URL}/challenges/${CHALLENGE_ID}`;
const DASHBOARD_URL = `${CHALLENGE_URL}/dashboard`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function signUp(page) {
  let lastErrorMessage = "Sign-up failed";

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const email = `playwright+${Date.now()}${attempt}@mailinator.com`;
    const uniqueName = `Playwright User ${Date.now().toString().slice(-6)}`;

    await page.goto(`${BASE_URL}/sign-up`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.locator('input[type="text"]').first().fill(uniqueName);
    await page.locator('input[type="email"]').first().fill(email);
    await page.locator('input[type="password"]').first().fill(PASSWORD);

    try {
      const signUpResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/auth/sign-up/email") &&
          response.request().method() === "POST",
        { timeout: 30_000 }
      );
      await page.locator('button[type="submit"]').first().click();
      const signUpResponse = await signUpResponsePromise;

      if (!signUpResponse.ok()) {
        lastErrorMessage = `Sign-up attempt ${attempt} failed with status ${signUpResponse.status()}`;
      } else {
        await page.goto(`${BASE_URL}/challenges`, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        if (!page.url().includes("/sign-in")) {
          return email;
        }
        lastErrorMessage = `Sign-up attempt ${attempt} got token but session was not authenticated`;
      }
    } catch (error) {
      lastErrorMessage = `Sign-up attempt ${attempt} error: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }

    await page.waitForTimeout(1_200);
  }

  throw new Error(lastErrorMessage);
}

async function joinChallenge(page) {
  await page.goto(CHALLENGE_URL, { waitUntil: "networkidle", timeout: 60_000 });

  const joinButton = page.getByRole("button", { name: /^Join Challenge$/ }).first();
  if (await joinButton.count()) {
    await joinButton.click({ timeout: 10_000 });
    await page.waitForTimeout(2_500);
  }
}

async function openActivityModal(page) {
  await page.goto(DASHBOARD_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3_500);

  const navButtons = page.locator("nav button");
  assert((await navButtons.count()) > 0, "No mobile nav buttons found");
  await navButtons.first().click({ timeout: 10_000 });
  await page.waitForTimeout(1_000);

  const combobox = page.locator('button[role="combobox"]').first();
  assert((await combobox.count()) > 0, "Activity type combobox not found");
  await combobox.click({ timeout: 10_000 });
  await page.waitForTimeout(750);
}

async function assertSelectorScrolls(page) {
  const list = page.locator("[cmdk-list]").first();
  assert((await list.count()) > 0, "Activity type list not found");

  const before = await list.evaluate((el) => ({
    scrollTop: el.scrollTop,
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
  }));
  assert(
    before.scrollHeight > before.clientHeight,
    `List is not overflowable (clientHeight=${before.clientHeight}, scrollHeight=${before.scrollHeight})`
  );

  const box = await list.boundingBox();
  assert(box, "Unable to measure list bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(300);

  const after = await list.evaluate((el) => ({
    scrollTop: el.scrollTop,
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
    overflowY: getComputedStyle(el).overflowY,
    touchAction: getComputedStyle(el).touchAction,
  }));
  assert(
    after.scrollTop > before.scrollTop,
    `List did not scroll (before=${before.scrollTop}, after=${after.scrollTop})`
  );

  return { before, after };
}

async function signInInFreshContext(browser, email) {
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  const signInResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/sign-in/email") &&
      response.request().method() === "POST",
    { timeout: 60_000 }
  );
  await page.locator('button[type="submit"]').first().click();
  const signInResponse = await signInResponsePromise;
  assert(
    signInResponse.ok(),
    `Sign-in failed with status ${signInResponse.status()}`
  );
  await page.goto(`${BASE_URL}/challenges`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  assert(
    !page.url().includes("/sign-in"),
    `Sign-in did not produce an authenticated session (url=${page.url()})`
  );
  return { context, page };
}

async function main() {
  let email = "";
  const browser = await chromium.launch({ headless: true });

  const primaryContext = await browser.newContext({ ...devices["iPhone 13"] });
  const primaryPage = await primaryContext.newPage();

  try {
    email = await signUp(primaryPage);
    await joinChallenge(primaryPage);
    await openActivityModal(primaryPage);
    const firstRun = await assertSelectorScrolls(primaryPage);

    const { context: reuseContext, page: reusePage } = await signInInFreshContext(
      browser,
      email
    );
    await joinChallenge(reusePage);
    await openActivityModal(reusePage);
    const secondRun = await assertSelectorScrolls(reusePage);

    console.log(
      JSON.stringify(
        {
          success: true,
          baseUrl: BASE_URL,
          challengeId: CHALLENGE_ID,
          email,
          firstRun,
          secondRun,
        },
        null,
        2
      )
    );

    await reuseContext.close();
    await primaryContext.close();
    await browser.close();
  } catch (error) {
    const safeError = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify(
        {
          success: false,
          baseUrl: BASE_URL,
          challengeId: CHALLENGE_ID,
          email,
          error: safeError,
        },
        null,
        2
      )
    );
    await primaryContext.close();
    await browser.close();
    process.exit(1);
  }
}

await main();
