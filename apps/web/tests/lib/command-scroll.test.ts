import { describe, expect, it } from "vitest";
import { COMMAND_LIST_SCROLL_CLASSES } from "@/components/ui/command";

describe("command list mobile scrolling", () => {
  it("includes touch-friendly scroll classes for mobile popovers/dialogs", () => {
    expect(COMMAND_LIST_SCROLL_CLASSES).toContain("overflow-y-auto");
    expect(COMMAND_LIST_SCROLL_CLASSES).toContain("touch-pan-y");
    expect(COMMAND_LIST_SCROLL_CLASSES).toContain("overscroll-contain");
    expect(COMMAND_LIST_SCROLL_CLASSES).toContain("[-webkit-overflow-scrolling:touch]");
  });
});
