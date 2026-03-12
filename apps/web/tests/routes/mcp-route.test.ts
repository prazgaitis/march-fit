import { beforeEach, describe, expect, test, vi } from "vitest";

const captureMessage = vi.fn();
const setTag = vi.fn();
const setUser = vi.fn();
const createMcpHandler = vi.fn();
const routeHandler = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureMessage,
  setTag,
  setUser,
}));

vi.mock("mcp-handler", () => ({
  createMcpHandler,
}));

async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/mcp/route");
}

describe("mcp route", () => {
  beforeEach(() => {
    captureMessage.mockReset();
    setTag.mockReset();
    setUser.mockReset();
    createMcpHandler.mockReset();
    routeHandler.mockReset();
    createMcpHandler.mockImplementation(() => routeHandler);
    global.fetch = vi.fn();
    process.env.CONVEX_SITE_URL = "https://private.convex.site";
  });

  test("returns 401 when no API token is provided", async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request("https://march.fit/api/mcp"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Missing or invalid Authorization header. Use: Bearer <api-key>",
    });
    expect(routeHandler).not.toHaveBeenCalled();
  });

  test("returns 401 when the API key is invalid", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "nope" }), { status: 401 }),
    );

    const { POST } = await loadRoute();
    const response = await POST(
      new Request("https://march.fit/api/mcp", {
        method: "POST",
        headers: {
          authorization: "Bearer mf_bad",
        },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid or revoked API key" });
    expect(routeHandler).not.toHaveBeenCalled();
  });

  test("accepts bearer auth, validates the key, and delegates to the MCP handler", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "u_1", username: "paulius" }), { status: 200 }),
    );
    routeHandler.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    const { DELETE } = await loadRoute();
    const request = new Request("https://march.fit/api/mcp", {
      method: "DELETE",
      headers: {
        authorization: "Bearer mf_good",
      },
    });
    const response = await DELETE(request);

    expect(global.fetch).toHaveBeenCalledWith(
      new URL("https://private.convex.site/api/v1/me"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer mf_good",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(setUser).toHaveBeenCalledWith({ id: "u_1", username: "paulius" });
    expect(setTag).toHaveBeenCalledWith("mcpUser", "paulius");
    expect(routeHandler).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  test("accepts token query params for clients that cannot send bearer auth", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "u_2", username: "cli-user" }), { status: 200 }),
    );
    routeHandler.mockResolvedValue(new Response("ok", { status: 200 }));

    const { GET } = await loadRoute();
    await GET(new Request("https://march.fit/api/mcp?token=mf_query_token"));

    expect(global.fetch).toHaveBeenCalledWith(
      new URL("https://private.convex.site/api/v1/me"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer mf_query_token",
        }),
      }),
    );
  });
});
