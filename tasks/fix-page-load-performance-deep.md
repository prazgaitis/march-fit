# Fix Page Load Performance - Deep Investigation

Date: 2026-02-13
Issue: Slow page loads and intermittent failures to load in production, especially on mobile.
Vercel Speed Insights: Desktop FCP 2.3s, Mobile FCP **59.4s**, Mobile INP **12,288ms**.

## Root Causes Identified

### CRITICAL: Tiptap rich text editor (~500KB) loaded on every page
The #1 issue. Tiptap was imported through **three separate paths** on every dashboard page:
1. `dashboard-layout.tsx` → `ActivityLogDialog` → `RichTextEditor` → `@tiptap/*`
2. `mobile-nav.tsx` → `ActivityLogDialog` → same chain
3. `activity-feed.tsx` → `RichTextViewer` → `rich-text.ts` → `@tiptap/html` + `StarterKit`

Even the "lightweight" `RichTextViewer` pulled in StarterKit because `rich-text.ts`
contained both the heavy Tiptap imports (generateHTML, StarterKit, Mention) and the
lightweight utils (isEditorContentEmpty, parseEditorContent) in the same module.
Importing ANY export from `rich-text.ts` pulled in ALL of Tiptap.

This ~500KB+ of JavaScript had to parse and hydrate on every page load, which on
mobile CPUs (10-30x slower than desktop) resulted in 59-second FCP.

### Other issues (fixed in earlier commits)
- No Suspense boundaries (loading.tsx)
- N+1 queries in getChallengeFeed (50+ db ops per page)
- Sequential media URL generation
- listPublic full table scan
- 16 module-level ConvexHttpClient instances
- Redundant getCurrentUser() auth calls
- Missing viewport metadata
- No image lazy loading
- Sequential waterfalls in server components
- getServerAuth() sequential internal calls

## Fixes Applied

### Bundle / Hydration (this commit)
- [x] Dynamic import `ActivityLogDialog` via `next/dynamic` with `ssr: false`
      — defers ALL of Tiptap editor until user clicks "Log activity"
- [x] Dynamic import `RichTextEditor` in activity-feed and activity-detail
      — editor only loads when comments are expanded
- [x] Write lightweight `rich-text-html.ts` JSON→HTML converter (~2KB) to replace
      Tiptap's `generateHTML` (~500KB) in `RichTextViewer`
- [x] Split `rich-text.ts` → `rich-text-utils.ts` (no Tiptap deps) for
      `isEditorContentEmpty`, `MentionableUser`, parsing functions
- [x] Update all consumer imports to use lightweight utils instead of `rich-text.ts`

### Server-side (earlier commits)
- [x] Add `loading.tsx` for key routes + root level
- [x] Optimize getChallengeFeed N+1 query
- [x] Fix sequential media URL generation (Promise.all)
- [x] Optimize listPublic with .take() instead of .collect()
- [x] Replace module-level ConvexHttpClient with per-request factory
- [x] Cache getCurrentUser() with React.cache
- [x] Add viewport metadata, lazy load images
- [x] Parallelize params + auth in server components
- [x] Parallelize getServerAuth() internals
- [x] Optimize home page redirect waterfall
