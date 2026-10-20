/**
 * Shared helpers for reasoning about an activity's media attachments.
 * Exists to keep the legacy (`mediaIds`, `cloudinaryPublicIds`, `imageUrl`)
 * and the new (`optimizedMediaIds`) fields in sync everywhere they matter —
 * the photo-bonus check on log, the edit-time dedupe, the feed-score media
 * count, and the backfill script.
 */

type MediaFields = {
  mediaIds?: unknown[] | null;
  cloudinaryPublicIds?: string[] | null;
  optimizedMediaIds?: string[] | null;
  imageUrl?: string | null;
};

/** True when any of the media-bearing fields carry a value. */
export function hasAnyMedia(fields: MediaFields): boolean {
  return (
    (!!fields.mediaIds && fields.mediaIds.length > 0) ||
    (!!fields.cloudinaryPublicIds && fields.cloudinaryPublicIds.length > 0) ||
    (!!fields.optimizedMediaIds && fields.optimizedMediaIds.length > 0) ||
    !!fields.imageUrl
  );
}

/** Total number of media attachments across all provider fields. Used by feed ranking. */
export function countMedia(fields: MediaFields): number {
  return (
    (fields.mediaIds?.length ?? 0) +
    (fields.cloudinaryPublicIds?.length ?? 0) +
    (fields.optimizedMediaIds?.length ?? 0)
  );
}
