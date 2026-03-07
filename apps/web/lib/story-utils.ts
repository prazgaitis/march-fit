import type { StoryItem, StorySlide } from "@/components/dashboard/stories-row";
import { getCloudinaryMediaUrl } from "@/lib/cloudinary";

/** Minimal activity shape needed to build story slides */
export interface StoryActivity {
  activityId: string;
  mediaUrls: string[];
  cloudinaryPublicIds?: string[];
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
  useCloudinary = true,
): StorySlide[] {
  return activities
    .sort((a, b) => b.createdAt - a.createdAt)
    .flatMap((a) => {
      const slides: StorySlide[] = [];

      // Cloudinary media (gated by useCloudinary flag for beta rollout)
      if (useCloudinary && a.cloudinaryPublicIds) {
        for (const id of a.cloudinaryPublicIds) {
          slides.push({
            activityId: a.activityId,
            mediaUrl: getCloudinaryMediaUrl(id, "full"),
            activityType: a.activityType,
            createdAt: a.createdAt,
            pointsEarned: a.pointsEarned,
            likes: a.likes,
            comments: a.comments,
            likedByUser: a.likedByUser,
          });
        }
      }

      // Legacy Convex storage URLs
      for (const mediaUrl of a.mediaUrls) {
        slides.push({
          activityId: a.activityId,
          mediaUrl,
          activityType: a.activityType,
          createdAt: a.createdAt,
          pointsEarned: a.pointsEarned,
          likes: a.likes,
          comments: a.comments,
          likedByUser: a.likedByUser,
        });
      }

      return slides;
    });
}

/** Build a single StoryItem for one user from their activities */
export function buildUserStory(
  user: StoryItem["user"],
  challengeId: string,
  activities: StoryActivity[],
  useCloudinary = true,
): StoryItem | null {
  const slides = activitiesToSlides(activities, useCloudinary);
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
  useCloudinary = true,
): StoryItem[] {
  const now = Date.now();
  const userMap = new Map<string, { user: StoryItem["user"]; activities: StoryActivity[] }>();

  for (const item of items) {
    const hasMedia = (item.mediaUrls && item.mediaUrls.length > 0) || (item.cloudinaryPublicIds && item.cloudinaryPublicIds.length > 0);
    if (!item.user || !hasMedia) continue;
    if (now - item.activity.createdAt > maxAgeMs) continue;

    const activity: StoryActivity = {
      activityId: item.activity._id,
      mediaUrls: item.mediaUrls ?? [],
      cloudinaryPublicIds: item.cloudinaryPublicIds,
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
    .map(({ user, activities }) => buildUserStory(user, challengeId, activities, useCloudinary)!)
    .filter(Boolean);
}
