import { describe, expect, it } from "vitest";
import { navItems } from "@/components/dashboard/dashboard-nav";
import { buildMobileNavLayout } from "@/components/dashboard/mobile-nav-layout";

describe("buildMobileNavLayout", () => {
  it("keeps Forum in the visible mobile nav and moves remaining items to overflow", () => {
    const layout = buildMobileNavLayout(navItems);

    expect(layout.leftItems.map((item) => item.label)).toEqual([
      "Home",
      "Notifications",
    ]);
    expect(layout.rightItems.map((item) => item.label)).toEqual(["Forum"]);
    expect(layout.overflowItems.map((item) => item.label)).toEqual([
      "Leaderboard",
      "Earning Points",
      "Profile",
    ]);
  });
});
