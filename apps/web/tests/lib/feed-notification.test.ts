import { describe, expect, it } from "vitest";

import { isLatestActivityVisibleInFeed } from "@/lib/feed-notification";

describe("isLatestActivityVisibleInFeed", () => {
  it("returns false when there is no latest activity id", () => {
    expect(
      isLatestActivityVisibleInFeed(
        [{ activity: { _id: "activity-1" } }],
        null,
      ),
    ).toBe(false);
  });

  it("returns false when feed is empty", () => {
    expect(isLatestActivityVisibleInFeed([], "activity-1")).toBe(false);
    expect(isLatestActivityVisibleInFeed(undefined, "activity-1")).toBe(false);
  });

  it("returns true when latest id matches activity _id", () => {
    expect(
      isLatestActivityVisibleInFeed(
        [{ activity: { _id: "activity-1" } }],
        "activity-1",
      ),
    ).toBe(true);
  });

  it("returns true when latest id matches activity id", () => {
    expect(
      isLatestActivityVisibleInFeed(
        [{ activity: { id: "activity-1" } }],
        "activity-1",
      ),
    ).toBe(true);
  });

  it("returns false when latest id does not exist in feed", () => {
    expect(
      isLatestActivityVisibleInFeed(
        [
          { activity: { _id: "activity-1" } },
          { activity: { id: "activity-2" } },
        ],
        "activity-3",
      ),
    ).toBe(false);
  });
});
