# Napkin

## Corrections
| Date | Source | What Went Wrong | What To Do Instead |
|------|--------|----------------|-------------------|
| 2026-02-11 | self | Ran `ls` before reading napkin (again) | Always read `.claude/napkin.md` before any other command |
| 2026-02-10 | self | Ran `ls` before reading napkin | Always read `.claude/napkin.md` before any other command |
| 2026-02-10 | self | Used backticks in a shell-quoted PR body so the shell tried to execute `turbo` | Use a heredoc or escape backticks when passing PR bodies to shell commands |

## User Preferences
- Hide navbar on full-screen flow pages (invite, dashboard, admin) via `ConditionalHeader` patterns + remove `page-with-header` class

## Patterns That Work
- Convex queries can join related data inline (e.g., activity types + categories in one query)
- `conditional-header.tsx` DASHBOARD_LAYOUT_PATTERNS array controls navbar visibility per route
- Admin console sidebar approach was scrapped — revisit admin nav design in the future

## Patterns That Don't Work
- Deriving env vars inside `convex deploy --cmd` shell strings — escaping hell, fragile, hard to debug. Instead, derive them in `next.config.ts` which runs at build time and can set `process.env` before Next.js compiles.

## Domain Notes
- Scoring configs have types: distance, duration, count, variant
- `page-with-header` CSS class = `pt-16` to offset fixed navbar
- Seed data lives in `packages/backend/actions/seed.ts`
- Schema changes auto-deploy locally via `pnpm dev`
| 2026-02-11 | self | Spent 10 commits trying to derive env vars inside `convex deploy --cmd` shell strings | Don't fight shell escaping — derive env vars in `next.config.ts` instead (runs at build time, sets `process.env`) |
