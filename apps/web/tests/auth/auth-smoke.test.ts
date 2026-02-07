import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/server-auth", () => ({
  fetchAuthQuery: vi.fn(),
  fetchAuthMutation: vi.fn(),
  getToken: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth";
import * as serverAuth from "@/lib/server-auth";

const mockedGetToken = vi.mocked(serverAuth.getToken);
const mockedFetchAuthQuery = vi.mocked(serverAuth.fetchAuthQuery);
const mockedFetchAuthMutation = vi.mocked(serverAuth.fetchAuthMutation);

describe("auth smoke", () => {
  beforeEach(() => {
    mockedGetToken.mockReset();
    mockedFetchAuthQuery.mockReset();
    mockedFetchAuthMutation.mockReset();
  });

  test("returns null when no auth token", async () => {
    mockedGetToken.mockResolvedValue(null as unknown as string | null);

    const result = await getCurrentUser();

    expect(result).toBeNull();
    expect(mockedFetchAuthQuery).not.toHaveBeenCalled();
    expect(mockedFetchAuthMutation).not.toHaveBeenCalled();
  });

  test("returns current user from authenticated query", async () => {
    mockedGetToken.mockResolvedValue("test-token");
    mockedFetchAuthQuery.mockResolvedValue({
      _id: "user_123",
      email: "test@example.com",
      name: "Test User",
      avatarUrl: null,
      role: "user",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      username: "test",
    } as unknown as NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>);

    const result = await getCurrentUser();

    expect(result?._id).toBe("user_123");
    expect(mockedFetchAuthMutation).not.toHaveBeenCalled();
  });

  test("falls back to ensureCurrent when current user missing", async () => {
    mockedGetToken.mockResolvedValue("test-token");
    mockedFetchAuthQuery.mockResolvedValue(null);
    mockedFetchAuthMutation.mockResolvedValue({
      _id: "user_456",
      email: "new@example.com",
      name: "New User",
      avatarUrl: null,
      role: "user",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      username: "new",
    } as unknown as NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>);

    const result = await getCurrentUser();

    expect(result?._id).toBe("user_456");
    expect(mockedFetchAuthMutation).toHaveBeenCalled();
  });
});
