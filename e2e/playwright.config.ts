import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env then .env.local (local overrides checked-in defaults)
for (const file of [".env", ".env.local"]) {
  const path = resolve(__dirname, file);
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    }
  }
}

const BASE_URL = process.env.E2E_BASE_URL ?? "https://march.fit";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // sequential — tests share state via persistent users
  reporter: process.env.CI ? [["html"], ["github"]] : [["html"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
