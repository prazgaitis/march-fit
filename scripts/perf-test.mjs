import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });

// Test with mobile emulation
const context = await browser.newContext({
  ...{
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  }
});

const page = await context.newPage();

// Sign in first
console.log('--- Sign in ---');
let start = performance.now();
await page.goto('https://www.march.fit/sign-in', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.fill('input[type="email"]', 'anon.admin.marchfit@gmail.com');
await page.fill('input[type="password"]', 'M4rchF1t!2026admin');
await page.click('button[type="submit"]');
await page.waitForTimeout(5000);
console.log(`Sign in → ${page.url()} (${Math.round(performance.now() - start)}ms)`);

// Test challenges page
console.log('\n--- /challenges (mobile) ---');
start = performance.now();
const challengesResponse = await page.goto('https://www.march.fit/challenges', { waitUntil: 'domcontentloaded' });
const dcl1 = Math.round(performance.now() - start);
await page.waitForLoadState('networkidle').catch(() => {});
const full1 = Math.round(performance.now() - start);
console.log(`Status: ${challengesResponse?.status()}`);
console.log(`DOMContentLoaded: ${dcl1}ms`);
console.log(`Network idle: ${full1}ms`);

// Check what's visible
const visibleText = await page.evaluate(() => document.body.innerText.substring(0, 500));
console.log(`Visible content: ${visibleText.substring(0, 200)}`);

// Test dashboard page
const challengeUrl = 'https://www.march.fit/challenges/js79t7qjg4sdehecxyngd3jjcs810wp1/dashboard';
console.log(`\n--- Dashboard (mobile) ---`);
start = performance.now();
const dashResponse = await page.goto(challengeUrl, { waitUntil: 'domcontentloaded' });
const dcl2 = Math.round(performance.now() - start);
await page.waitForLoadState('networkidle').catch(() => {});
const full2 = Math.round(performance.now() - start);
console.log(`Status: ${dashResponse?.status()}`);
console.log(`DOMContentLoaded: ${dcl2}ms`);
console.log(`Network idle: ${full2}ms`);

// Also test desktop for comparison
const desktopContext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const desktopPage = await desktopContext.newPage();

// Sign in on desktop
await desktopPage.goto('https://www.march.fit/sign-in', { waitUntil: 'domcontentloaded' });
await desktopPage.waitForTimeout(2000);
await desktopPage.fill('input[type="email"]', 'anon.admin.marchfit@gmail.com');
await desktopPage.fill('input[type="password"]', 'M4rchF1t!2026admin');
await desktopPage.click('button[type="submit"]');
await desktopPage.waitForTimeout(5000);

console.log(`\n--- /challenges (desktop) ---`);
start = performance.now();
await desktopPage.goto('https://www.march.fit/challenges', { waitUntil: 'domcontentloaded' });
const dcl3 = Math.round(performance.now() - start);
await desktopPage.waitForLoadState('networkidle').catch(() => {});
const full3 = Math.round(performance.now() - start);
console.log(`DOMContentLoaded: ${dcl3}ms`);
console.log(`Network idle: ${full3}ms`);

console.log(`\n--- Dashboard (desktop) ---`);
start = performance.now();
await desktopPage.goto(challengeUrl, { waitUntil: 'domcontentloaded' });
const dcl4 = Math.round(performance.now() - start);
await desktopPage.waitForLoadState('networkidle').catch(() => {});
const full4 = Math.round(performance.now() - start);
console.log(`DOMContentLoaded: ${dcl4}ms`);
console.log(`Network idle: ${full4}ms`);

await browser.close();
