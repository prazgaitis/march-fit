# Napkin

## Corrections
| Date | Source | What Went Wrong | What To Do Instead |
|------|--------|----------------|-------------------|

## User Preferences
- Hide navbar on full-screen flow pages (invite, dashboard, admin) via `ConditionalHeader` patterns + remove `page-with-header` class

## Patterns That Work
- Convex queries can join related data inline (e.g., activity types + categories in one query)
- `conditional-header.tsx` DASHBOARD_LAYOUT_PATTERNS array controls navbar visibility per route

## Patterns That Don't Work

## Domain Notes
- Scoring configs have types: distance, duration, count, variant
- `page-with-header` CSS class = `pt-16` to offset fixed navbar
- Seed data lives in `packages/backend/actions/seed.ts`
- Schema changes auto-deploy locally via `pnpm dev`
