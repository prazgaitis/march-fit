interface FeedActivity {
  activity?: {
    _id?: string;
    id?: string;
  } | null;
}

export function isLatestActivityVisibleInFeed(
  items: FeedActivity[] | undefined,
  latestActivityId: string | null,
): boolean {
  if (!latestActivityId || !items?.length) {
    return false;
  }

  return items.some((item) => {
    const activity = item.activity;
    if (!activity) {
      return false;
    }
    return activity._id === latestActivityId || activity.id === latestActivityId;
  });
}
