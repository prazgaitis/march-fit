import { beforeEach, describe, expect, test, vi } from "vitest";

const fetchAuthQuery = vi.fn();

vi.mock("@/lib/server-auth", () => ({
  fetchAuthQuery,
}));

async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/challenges/[id]/feed/route");
}

describe("challenge feed route", () => {
  beforeEach(() => {
    fetchAuthQuery.mockReset();
  });

  test("uses sane defaults and forwards challenge feed query", async () => {
    fetchAuthQuery.mockResolvedValue({ page: ["a"] });

    const { POST } = await loadRoute();
    const response = await POST(
      new Request("https://march.fit/api/challenges/ch_123/feed", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "ch_123" }) },
    );

    expect(fetchAuthQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        challengeId: "ch_123",
        followingOnly: false,
        includeEngagementCounts: true,
        includeMediaUrls: true,
        paginationOpts: {
          numItems: 10,
          cursor: null,
        },
      }),
    );
    await expect(response.json()).resolves.toEqual({ page: ["a"] });
  });

  test("clamps pagination values and preserves explicit flags", async () => {
    fetchAuthQuery.mockResolvedValue({ page: ["b"] });

    const { POST } = await loadRoute();
    await POST(
      new Request("https://march.fit/api/challenges/ch_123/feed", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          followingOnly: true,
          includeEngagementCounts: false,
          includeMediaUrls: false,
          cursor: "cursor_1",
          numItems: 999,
        }),
      }),
      { params: Promise.resolve({ id: "ch_123" }) },
    );

    expect(fetchAuthQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        followingOnly: true,
        includeEngagementCounts: false,
        includeMediaUrls: false,
        paginationOpts: {
          numItems: 50,
          cursor: "cursor_1",
        },
      }),
    );
  });

  test("returns 500 when the feed query fails", async () => {
    fetchAuthQuery.mockRejectedValue(new Error("boom"));

    const { POST } = await loadRoute();
    const response = await POST(
      new Request("https://march.fit/api/challenges/ch_123/feed", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "ch_123" }) },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to load feed" });
  });
});
