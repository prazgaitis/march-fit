# Fix Activity Feed Pagination Error

**Date:** 2026-03-01
**Issue:** Sentry error #7280439142 — `getChallengeFeed` throws "multiple paginated queries" error

## Problem

The `getChallengeFeed` query uses Convex's built-in `.paginate()` for the main activity feed, but also calls `.collect()` within the hydration loop to count likes and comments per activity. Convex only allows a single paginated query per function execution; `.collect()` on larger result sets can internally trigger paginated reads, conflicting with the explicit `.paginate()` call.

**Error:** `Uncaught Error: This query or mutation function ran multiple paginated queries. Convex only supports a single paginated query in each function.`

**Stack:** `handler in ../../queries/activities.ts [Line 229]`

## Fix

- [x] Replace `.collect()` calls with bounded `.take()` reads for likes and comments counting inside the paginated hydration loop
- [x] Replace `.collect()` on the follows query with `.take()` to be defensive
- [x] Verify typecheck and lint pass

## Notes

- `.take(n)` avoids the internal pagination mechanism that `.collect()` can trigger for larger result sets
- The limits chosen (1000 for follows, 500 for likes/comments) are generous for real-world usage and stay within Convex's per-function document read limits
