import { beforeEach, describe, expect, test, vi } from "vitest";

const handler = {
  GET: vi.fn(),
  POST: vi.fn(),
};

vi.mock("@/lib/server-auth", () => ({
  betterAuthHandler: handler,
}));

async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/auth/[...all]/route");
}

describe("auth route module", () => {
  beforeEach(() => {
    handler.GET.mockReset();
    handler.POST.mockReset();
  });

  test("re-exports the Better Auth GET and POST handlers", async () => {
    const routeModule = await loadRoute();

    expect(routeModule.GET).toBe(handler.GET);
    expect(routeModule.POST).toBe(handler.POST);
    expect(routeModule.runtime).toBe("nodejs");
  });
});
