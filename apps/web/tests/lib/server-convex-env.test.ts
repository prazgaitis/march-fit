import { afterEach, describe, expect, test, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function loadModule() {
  vi.resetModules();
  return import("@/lib/server-convex-env");
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("server convex env", () => {
  test("prefers private convex URL when available", async () => {
    process.env.CONVEX_URL = "https://private.convex.cloud/";
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://public.convex.cloud/";

    const { getServerConvexUrl } = await loadModule();

    expect(getServerConvexUrl()).toBe("https://private.convex.cloud");
  });

  test("falls back to public convex URL for backward compatibility", async () => {
    delete process.env.CONVEX_URL;
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://public.convex.cloud/";

    const { getServerConvexUrl } = await loadModule();

    expect(getServerConvexUrl()).toBe("https://public.convex.cloud");
  });

  test("prefers private convex site URL when available", async () => {
    process.env.CONVEX_SITE_URL = "https://private.convex.site/";
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = "https://public.convex.site/";

    const { getServerConvexSiteUrl } = await loadModule();

    expect(getServerConvexSiteUrl()).toBe("https://private.convex.site");
  });

  test("derives convex site URL from private cloud URL", async () => {
    process.env.CONVEX_URL = "https://demo.convex.cloud";
    delete process.env.CONVEX_SITE_URL;
    delete process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

    const { getServerConvexSiteUrl } = await loadModule();

    expect(getServerConvexSiteUrl()).toBe("https://demo.convex.site");
  });

  test("derives local convex site URL from local convex URL", async () => {
    process.env.CONVEX_URL = "http://127.0.0.1:3210";
    delete process.env.CONVEX_SITE_URL;
    delete process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

    const { getServerConvexSiteUrl } = await loadModule();

    expect(getServerConvexSiteUrl()).toBe("http://127.0.0.1:3211");
  });

  test("throws when no convex URL is configured", async () => {
    delete process.env.CONVEX_URL;
    delete process.env.NEXT_PUBLIC_CONVEX_URL;

    const { getServerConvexUrl } = await loadModule();

    expect(() => getServerConvexUrl()).toThrow(
      "Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL",
    );
  });
});
