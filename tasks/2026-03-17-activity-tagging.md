# Activity Tagging Feature

**Date:** 2026-03-17
**Description:** When someone tags another person in an activity, create a feed presence for the tagged user with special treatment and higher feed score.

## Requirements

- [x] Add `activityTags` table to track tags
- [x] Add `taggedUserIds` optional field to activity log mutation
- [x] Create `activityTags` records when activity is logged with tags
- [x] Notify tagged users
- [x] Tagged activities get a higher feed score (TAG_BOOST)
- [x] Tagged users should NOT receive points for tagged activities
- [x] Tagged users can dismiss tagged activities from their feed
- [x] Feed queries surface tagged activities in the tagged user's feed
- [x] Background task finds related activities (tagged user's own logged activity on same date/type) and links them
- [x] Group related activities in feed display
- [x] Robust test coverage

## Schema Design

### `activityTags` table
- `activityId`: Id<"activities"> — the original activity
- `taggedUserId`: Id<"users"> — the user who was tagged
- `challengeId`: Id<"challenges"> — for feed scoping
- `dismissedAt`: optional number — when the tagged user removed it from their feed
- `relatedActivityId`: optional Id<"activities"> — the tagged user's own matching activity (set by background job)
- `createdAt`: number

### Indexes
- `activityId` — look up tags for an activity
- `taggedUserChallenge` — feed query: find activities where user was tagged in a challenge
- `activityTaggedUser` — uniqueness check

## Feed Scoring

- Activities with tags get a content score boost: `TAG_BOOST = 8` per tag (capped at 24)
- Tagged activities appear in the tagged user's feed via a secondary query merged into the ranked list

## Feed Display

- Tagged activities appear with "X tagged you" treatment
- If a `relatedActivityId` exists, the UI can group them ("You both did Running on Jan 5")

## Background Job

- `linkRelatedActivities` internal mutation scheduled after tags are created
- Searches for non-deleted activities by the tagged user in the same challenge on the same `loggedDate`
- If found, updates the `activityTags.relatedActivityId` field

## Implementation Notes

- Tags are created in the `log` mutation to avoid a separate write path
- Edit mutation supports adding/removing tags
- Dismiss mutation is user-facing (tagged user only)
- No points are awarded to tagged users — this is purely a feed/social feature
