import type { StoryItem, StorySlide } from "@/components/dashboard/stories-row";
import { getOptimizedMediaUrl } from "@/lib/media-optimizer";

/** Minimal activity shape needed to build story slides */
export interface StoryActivity {
  activityId: string;
  mediaUrls: string[];
  /** Optimized media public IDs (e.g. Cloudinary). When present and useOptimized is true, these are preferred. */
  optimizedMediaIds?: string[];
  activityType: string | null;
  createdAt: number;
  pointsEarned: number;
  likes: number;
  comments: number;
  likedByUser: boolean;
}

/** Flatten activities into individual StorySlides (one per media URL) */
export function activitiesToSlides(
  activities: StoryActivity[],
  useOptimized = false,
): StorySlide[] {
  return activities
    .sort((a, b) => b.createdAt - a.createdAt)
    .flatMap((a) => {
      const urls =
        useOptimized && a.optimizedMediaIds && a.optimizedMediaIds.length > 0
          ? a.optimizedMediaIds.map((id) => getOptimizedMediaUrl(id, "full"))
          : a.mediaUrls;

      return urls.map((mediaUrl) => ({
        activityId: a.activityId,
        mediaUrl,
        activityType: a.activityType,
        createdAt: a.createdAt,
        pointsEarned: a.pointsEarned,
        likes: a.likes,
        comments: a.comments,
        likedByUser: a.likedByUser,
      }));
    });
}

/** Build a single StoryItem for one user from their activities */
export function buildUserStory(
  user: StoryItem["user"],
  challengeId: string,
  activities: StoryActivity[],
  useOptimized = false,
): StoryItem | null {
  const slides = activitiesToSlides(activities, useOptimized);
  if (slides.length === 0) return null;
  return { user, challengeId, slides };
}

/**
 * Build StoryItems grouped by user from a flat list of feed items.
 * Each feed item needs a `user` object and activity data.
 */
export function buildStoriesFromFeed(
  items: Array<{
    user: { id: string; name: string | null; username: string; avatarUrl: string | null };
    activity: { _id: string; createdAt: number; pointsEarned: number };
    activityType: { name: string | null } | null;
    mediaUrls: string[];
    cloudinaryPublicIds?: string[];
    likes: number;
    comments: number;
    likedByUser: boolean;
  }>,
  challengeId: string,
  maxAgeMs: number,
  maxUsers = 20,
  useOptimized = false,
): StoryItem[] {
  const now = Date.now();
  const userMap = new Map<string, { user: StoryItem["user"]; activities: StoryActivity[] }>();

  for (const item of items) {
    const hasMedia =
      (item.mediaUrls && item.mediaUrls.length > 0) ||
      (item.cloudinaryPublicIds && item.cloudinaryPublicIds.length > 0);
    if (!item.user || !hasMedia) continue;
    if (now - item.activity.createdAt > maxAgeMs) continue;

    const activity: StoryActivity = {
      activityId: item.activity._id,
      mediaUrls: item.mediaUrls,
      optimizedMediaIds: item.cloudinaryPublicIds,
      activityType: item.activityType?.name ?? null,
      createdAt: item.activity.createdAt,
      pointsEarned: item.activity.pointsEarned,
      likes: item.likes,
      comments: item.comments,
      likedByUser: item.likedByUser,
    };

    const existing = userMap.get(item.user.id);
    if (existing) {
      existing.activities.push(activity);
    } else {
      userMap.set(item.user.id, {
        user: {
          id: item.user.id,
          name: item.user.name,
          username: item.user.username,
          avatarUrl: item.user.avatarUrl,
        },
        activities: [activity],
      });
    }
  }

  return Array.from(userMap.values())
    .sort((a, b) => {
      const aMax = Math.max(...a.activities.map((i) => i.createdAt));
      const bMax = Math.max(...b.activities.map((i) => i.createdAt));
      return bMax - aMax;
    })
    .slice(0, maxUsers)
    .map(({ user, activities }) => buildUserStory(user, challengeId, activities, useOptimized)!)
    .filter(Boolean);
}
