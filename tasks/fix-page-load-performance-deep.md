# Fix Page Load Performance - Deep Investigation

Date: 2026-02-13
Issue: Slow page loads and intermittent failures to load in production, especially on mobile.

## Root Causes Identified

### 1. No Suspense boundaries (loading.tsx)
No `loading.tsx` files exist anywhere in the app. Without them, the full SSR waterfall
must complete before *anything* renders. If any server query is slow or times out, the
user sees a blank screen indefinitely. This is worse on mobile where network latency
is higher.

### 2. N+1 queries in `getChallengeFeed` (CRITICAL)
For each activity in the feed (10 per page), 5 parallel sub-queries run per item:
- `db.get(userId)` — user lookup
- `db.get(activityTypeId)` — activity type lookup
- `likes.collect().then(l => l.length)` — full scan to count likes
- `comments.collect().then(c => c.length)` — full scan to count comments
- `getCurrentUser()` + likes query — per-item auth check (redundant per item!)

That's **50+ database operations per page load**. The `getCurrentUser()` was being
called inside every `.map()` iteration despite returning the same result.

### 3. Sequential media URL generation
`activities.ts` uses `for...of` with `await` to generate media URLs one at a time
instead of `Promise.all`. Applies to `getById`, `getChallengeFeed`, and `getMediaUrls`.

### 4. `listPublic` full table scan
`challenges.ts` collects ALL challenges into memory via `.collect()`, filters by
visibility in JS, sorts in memory, then does N individual participant-count queries.

### 5. 16 module-level `ConvexHttpClient` instances
Every server component creates `new ConvexHttpClient(url)` at the module top level.
In Vercel's serverless environment these can become stale between warm invocations or
share state across requests. Particularly problematic on mobile where connections
are less reliable.

### 6. Redundant `getCurrentUser()` auth calls
The root layout calls `getToken()` + `preloadAuthQuery(users.current)`.
Child pages then call `getCurrentUser()` which calls `getToken()` +
`fetchAuthQuery(users.current)` again — doubling auth round-trips.

### 7. Missing viewport metadata (mobile-specific)
No explicit `viewport` export in the root layout, which can cause mobile browsers
to use incorrect viewport width.

### 8. No image lazy loading (mobile-specific)
Feed images in `activity-feed.tsx` use plain `<img>` tags without `loading="lazy"`,
causing all images to load eagerly and wasting bandwidth on mobile.

### 9. Waterfall in page server components
Multiple pages (`await getCurrentUser()` then `await params`) resolve sequentially
instead of in parallel with `Promise.all`.

## Fixes Applied

- [x] Add `loading.tsx` files for key routes (dashboard, challenge detail, leaderboard)
- [x] Optimize `getChallengeFeed` — move `getCurrentUser` out of per-item loop,
      reduce from 50+ to ~30 db operations per page, use `Promise.all` for media URLs
- [x] Fix sequential media URL generation in `getById`, `getChallengeFeed`, `getMediaUrls`
- [x] Optimize `listPublic` — use `.take()` with bounded limit instead of `.collect()`
- [x] Replace 16 module-level `ConvexHttpClient` instances with per-request `getConvexClient()` factory
- [x] Cache `getCurrentUser()` with `React.cache` to deduplicate across layout + child pages
- [x] Add explicit `viewport` metadata export for mobile
- [x] Add `loading="lazy"` to feed images
- [x] Parallelize `getCurrentUser()` + `params` in 6 page server components
