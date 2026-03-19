import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: all vaul Drawer root instances must use `handleOnly`.
 *
 * Without `handleOnly`, the vaul drawer intercepts touch/pointer events on its
 * entire content area for drag-to-dismiss detection. On mobile this prevents
 * taps on interactive children (Links, buttons) from firing their click handlers.
 *
 * See PRs #226 (ResponsiveDialog) and #235 (MoreDrawer) for the original fixes.
 */

const COMPONENTS_DIR = path.resolve(__dirname, "../../components");
const APP_DIR = path.resolve(__dirname, "../../app");

/** Recursively collect all .tsx files under a directory. */
function collectTsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsxFiles(fullPath));
    } else if (entry.name.endsWith(".tsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("Drawer handleOnly enforcement", () => {
  // The drawer.tsx UI wrapper itself is excluded — it defines the primitives.
  const DRAWER_DEFINITION = path.resolve(COMPONENTS_DIR, "ui/drawer.tsx");

  it("every <Drawer usage (excluding the UI primitive) must include handleOnly", () => {
    const files = [...collectTsxFiles(COMPONENTS_DIR), ...collectTsxFiles(APP_DIR)];
    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of files) {
      if (file === DRAWER_DEFINITION) continue;

      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match <Drawer but not <DrawerTrigger, <DrawerContent, etc.
        // Also match <DrawerNestedRoot which is another drawer root.
        const isDrawerRoot =
          /<Drawer[\s>]/.test(line) &&
          !/<Drawer(?:Trigger|Content|Overlay|Portal|Close|Handle|Title|Description|Header|Footer|NestedRoot)/.test(line);
        const isNestedRoot = /<DrawerNestedRoot[\s>]/.test(line);

        if (isDrawerRoot || isNestedRoot) {
          if (!line.includes("handleOnly")) {
            const relPath = path.relative(path.resolve(__dirname, "../.."), file);
            violations.push({ file: relPath, line: i + 1, text: line.trim() });
          }
        }
      }
    }

    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${v.file}:${v.line}\n    ${v.text}`)
        .join("\n");
      expect.fail(
        `Found Drawer root(s) without handleOnly. On mobile, the vaul drawer's ` +
        `drag gesture intercepts taps on child elements (Links, buttons). ` +
        `Add the handleOnly prop to fix.\n\n${msg}`
      );
    }
  });
});
