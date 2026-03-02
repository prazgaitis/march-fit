# Algorithmic Feed Scoring

**Date:** 2026-03-02
**Status:** Design
**Description:** Replace chronological feed with an algorithmic feed that surfaces interesting, engaging, and socially relevant activities.

---

## Problem

The current feed (`getChallengeFeed`) is purely chronological — newest first. This means a high-effort activity with photos and a great description gets buried by a batch of bland auto-logged Strava entries. We need a scoring algorithm that rewards quality content and social relevance.

---

## Scoring Algorithm

### Feed Score Formula

Each activity gets a **static content score** (computed once + updated on engagement changes) and a **personalized score** (applied at query time per-viewer).

```
displayScore = (contentScore + personalizationBoost) * timeDecay
```

### 1. Content Score (stored on activity, recomputed on changes)

| Signal | Scoring Rule | Max | Rationale |
|--------|-------------|-----|-----------|
| **Description quality** | `notes` length: 20-49 chars → +2, 50-99 → +5, 100+ → +8 | 8 | Good descriptions = interesting content |
| **Has media** | +5 per media item | 15 | Photos/videos make posts engaging |
| **Points earned** | `min(log2(pointsEarned + 1) * 2, 12)` | 12 | High-effort activities are interesting |
| **Bonus points** | +4 per triggered bonus | 16 | Bonus thresholds = impressive achievements |
| **Flagged penalty** | flagged → -100 | -100 | Flagged content sinks to bottom |
| **Base score** | Every activity starts with | 1 | Ensures non-zero baseline |

**Content score range:** 1 to ~52 (unflagged), -100 (flagged)

### 2. Engagement Score (stored on activity, updated via triggers)

| Signal | Scoring Rule | Max | Rationale |
|--------|-------------|-----|-----------|
| **Likes** | `min(likes * 3, 30)` | 30 | Linear scaling, capped to avoid runaway |
| **Comments** | `min(comments * 5, 30)` | 30 | Comments = higher engagement signal than likes |

**Engagement score range:** 0 to 60

### 3. Personalization Boost (computed at query time, per-viewer)

| Signal | Scoring Rule | Rationale |
|--------|-------------|-----------|
| **Following** | Activity author is in viewer's following list → +15 | Social relevance |
| **Not self** | Viewer's own activities → +0 (no boost, no penalty) | Neutral for own content |

### 4. Time Decay (computed at query time)

```
timeDecay = 1 / (1 + hoursAge / 24)
```

This gives a smooth decay curve:
- 0 hours old → 1.0x (full score)
- 12 hours → 0.67x
- 24 hours → 0.5x
- 48 hours → 0.33x
- 72 hours → 0.25x
- 7 days → 0.125x

Activities never fully disappear, but fresh content naturally wins ties.

### Example Scores

| Activity | Content | Engagement | Following | Age | Final |
|----------|---------|-----------|-----------|-----|-------|
| Strava auto-log, no notes, no media, 5pts | 1+0+0+5=6 | 0 | 0 | 1h → 0.96 | **5.8** |
| Manual log, 120-char description, 2 photos, 15pts, 1 bonus | 1+8+10+8+4=31 | 0 | 0 | 1h → 0.96 | **29.8** |
| Same as above + 5 likes, 2 comments | 31 | 15+10=25 | 0 | 1h → 0.96 | **53.8** |
| Same + you follow them | 31 | 25 | +15 | 1h → 0.96 | **68.2** |
| Bland activity from yesterday | 6 | 0 | 0 | 30h → 0.44 | **2.6** |

---

## Architecture

### Option A: Denormalized `feedScore` field on activities (Recommended)

- [ ] Add `feedScore: v.optional(v.number())` field to the `activities` table
- [ ] Add index `feedScoreRanked: ["challengeId", "feedScore"]` for efficient ordering
- [ ] Compute `feedScore = contentScore + engagementScore` at write time
- [ ] Recompute on: activity create, activity update (notes/media change), like toggle, comment create/delete
- [ ] Apply personalization (following boost) and time decay at query time
- [ ] Sort by final computed score client-side within each page (since personalization varies per user)

**Pros:** Single index scan for ordering, minimal query-time computation
**Cons:** Requires updating score on engagement changes (like/comment triggers)

### Score Computation Triggers

```
Activity created → compute feedScore (content signals only, engagement = 0)
Activity updated → recompute feedScore (content signals may have changed)
Like toggled → recompute feedScore (engagement changed)
Comment created/deleted → recompute feedScore (engagement changed)
```

### Query Architecture

```typescript
// New query: getAlgorithmicFeed
1. Fetch page of activities ordered by feedScore DESC (index scan)
2. Load viewer's following list (same as current followingOnly logic)
3. For each activity in page:
   a. Compute personalizedScore = feedScore + (isFollowing ? 15 : 0)
   b. Compute timeDecay = 1 / (1 + hoursAge / 24)
   c. finalScore = personalizedScore * timeDecay
4. Re-sort page by finalScore DESC
5. Return enriched feed items (same shape as current feed)
```

### Feed Mode Toggle

- [ ] Add a `feedMode` arg to the feed query: `"chronological" | "algorithmic"` (default: `"algorithmic"`)
- [ ] Keep the existing chronological path as-is for fallback
- [ ] UI toggle or tab to switch between modes

### Implementation Checklist

**Schema & scoring function:**
- [ ] Add `feedScore` field to activities schema
- [ ] Add `feedScoreRanked` index on `["challengeId", "feedScore"]`
- [ ] Create `lib/feedScoring.ts` with pure scoring functions
- [ ] Write unit tests for scoring functions

**Score computation triggers:**
- [ ] Update activity create mutation to compute initial `feedScore`
- [ ] Update activity update mutation to recompute `feedScore`
- [ ] Update like toggle mutation to recompute activity `feedScore`
- [ ] Update comment create mutation to recompute activity `feedScore`
- [ ] Add helper: `recomputeFeedScore(ctx, activityId)` that reads counts and updates

**Feed query:**
- [ ] Create `getAlgorithmicFeed` query (or extend `getChallengeFeed` with feedMode arg)
- [ ] Implement personalization layer (following boost)
- [ ] Implement time decay at query time
- [ ] Re-sort within page by final score

**Backfill:**
- [ ] Write a migration/backfill script to compute `feedScore` for all existing activities
- [ ] Run backfill against local dev, then production

**Frontend:**
- [ ] Add feed mode toggle to activity feed component
- [ ] Default to algorithmic, allow switch to chronological
- [ ] Ensure pagination still works smoothly with algorithmic ordering

---

## Design Decisions & Trade-offs

### Why not compute everything at query time?
Convex doesn't support complex ORDER BY expressions in queries. We need an indexed field to sort by. Storing `feedScore` lets us use an index for the primary ordering, then apply lightweight personalization/decay in the query handler.

### Why not a separate `feedScores` table?
Extra join on every feed load. Keeping it on the activity row means one fewer lookup per item in an already lookup-heavy query.

### Why linear engagement scaling instead of log?
With challenge sizes of ~50-200 people, engagement counts stay low (rarely >20 likes). Linear scaling with caps is simpler and gives enough differentiation without needing log curves.

### Why not ML-based text quality scoring?
Overkill for this scale. Length-based heuristic captures the intent (rewarding effort) without the complexity. Can revisit later if needed.

### Pagination caveat
Since personalization and time decay are applied post-fetch, the page ordering isn't perfectly globally sorted. This is acceptable — the index-based `feedScore` ordering gets us 90% of the way, and the lightweight re-sort within each page handles the rest. This is the same approach Instagram/Twitter use (approximate ranking with refinement).
