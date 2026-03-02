import { describe, expect, it } from "vitest";
import {
  filterLeaderboardUsers,
  type SearchableLeaderboardEntry,
} from "@/components/dashboard/user-search-filter";

function buildLeaderboard(count: number): SearchableLeaderboardEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    totalPoints: count - i,
    user: {
      id: `user_${i}`,
      name: i % 2 === 0 ? `Runner ${i}` : null,
      username: `runner_${i}`,
      avatarUrl: null,
    },
  }));
}

describe("filterLeaderboardUsers", () => {
  it("returns empty list for empty/whitespace query", () => {
    const leaderboard = buildLeaderboard(20);
    expect(filterLeaderboardUsers(leaderboard, "")).toEqual([]);
    expect(filterLeaderboardUsers(leaderboard, "   ")).toEqual([]);
  });

  it("matches by username and includes users beyond top-10/top-100 positions", () => {
    const leaderboard = buildLeaderboard(120);
    const result = filterLeaderboardUsers(leaderboard, "runner_119");

    expect(result).toHaveLength(1);
    expect(result[0]?.user.id).toBe("user_119");
  });

  it("matches by name when present", () => {
    const leaderboard = buildLeaderboard(120);
    const result = filterLeaderboardUsers(leaderboard, "runner 118");

    expect(result).toHaveLength(1);
    expect(result[0]?.user.username).toBe("runner_118");
  });
});
