import { describe, expect, test } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression test for https://github.com/get-convex/better-auth/issues/206
 *
 * The Convex adapter stores date fields as epoch-ms numbers. When Better Auth
 * passes an ISO-string date in a where clause (e.g. deleteMany expired
 * verifications), the adapter must convert it to a number. Otherwise Convex
 * compares number < string, which is always true in its type ordering, and
 * every record gets deleted — including non-expired ones.
 *
 * Our pnpm patch on @convex-dev/better-auth adds this conversion to
 * parseWhere.
 */

/** Mirrors the patched logic in parseWhere */
function convertWhereValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
  ) {
    const ms = new Date(value).getTime();
    if (!isNaN(ms)) {
      return ms;
    }
  }
  return value;
}

describe("parseWhere ISO-date patch", () => {
  test("converts ISO date strings to epoch ms", () => {
    const result = convertWhereValue("2026-02-23T02:53:56.605Z");
    expect(typeof result).toBe("number");
    expect(result).toBe(new Date("2026-02-23T02:53:56.605Z").getTime());

    expect(convertWhereValue("1970-01-01T00:00:00.000Z")).toBe(0);
  });

  test("converts Date objects to epoch ms", () => {
    const d = new Date("2026-02-23T02:53:56.605Z");
    expect(convertWhereValue(d)).toBe(d.getTime());
  });

  test("leaves non-date strings unchanged", () => {
    expect(convertWhereValue("prazgaitis@gmail.com")).toBe(
      "prazgaitis@gmail.com"
    );
    expect(convertWhereValue("reset-password:abc123")).toBe(
      "reset-password:abc123"
    );
    expect(convertWhereValue("12345")).toBe("12345");
    expect(convertWhereValue("")).toBe("");
  });

  test("leaves numbers and other types unchanged", () => {
    expect(convertWhereValue(1771815236605)).toBe(1771815236605);
    expect(convertWhereValue(null)).toBe(null);
    expect(convertWhereValue(true)).toBe(true);
  });

  test("the bug: numeric expiresAt is NOT less than a future epoch ms", () => {
    // Stored verification expiresAt (1 hour from now)
    const storedExpiresAt = 1771818826591;
    // The cleanup query: delete where expiresAt < now
    const nowIso = "2026-02-23T02:53:56.605Z";

    // With the patch: ISO string → epoch ms, then compare correctly
    const nowMs = convertWhereValue(nowIso) as number;
    expect(storedExpiresAt < nowMs).toBe(false); // record should survive
  });

  test("the patch file exists and contains the ISO date fix", () => {
    const patchPath = resolve(
      __dirname,
      "../../../../patches/@convex-dev__better-auth@0.10.11.patch"
    );
    const patch = readFileSync(patchPath, "utf-8");
    expect(patch).toContain("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}");
    expect(patch).toContain("new Date(w.value).getTime()");
  });
});
