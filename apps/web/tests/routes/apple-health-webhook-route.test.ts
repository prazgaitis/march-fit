import { describe, expect, test } from "vitest";

import { POST } from "@/app/api/webhooks/apple-health/route";

describe("apple health webhook route", () => {
  test("accepts valid JSON payloads", async () => {
    const response = await POST(
      new Request("https://march.fit/api/webhooks/apple-health", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ steps: 1000 }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
  });

  test("returns 400 for invalid JSON payloads", async () => {
    const response = await POST(
      new Request("https://march.fit/api/webhooks/apple-health", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{not-json}",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid payload" });
  });
});
