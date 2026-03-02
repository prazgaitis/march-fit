interface SearchUser {
  id: string;
  name: string | null;
  username: string;
  avatarUrl: string | null;
}

export interface SearchableLeaderboardEntry {
  totalPoints: number;
  user: SearchUser;
}

export function filterLeaderboardUsers(
  leaderboard: SearchableLeaderboardEntry[] | undefined,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [] as SearchableLeaderboardEntry[];
  }

  return (leaderboard ?? []).filter(
    (entry) =>
      entry.user.name?.toLowerCase().includes(normalizedQuery) ||
      entry.user.username?.toLowerCase().includes(normalizedQuery),
  );
}
