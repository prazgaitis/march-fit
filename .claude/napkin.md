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

## Domain Notes
- Scoring configs have types: distance, duration, count, variant
- `page-with-header` CSS class = `pt-16` to offset fixed navbar
- Seed data lives in `packages/backend/actions/seed.ts`
- Schema changes auto-deploy locally via `pnpm dev`
| 2026-02-11 | self | Set NEXT_PUBLIC_CONVEX_SITE_URL without export, so child process didn't receive it | Use `export` (or VAR=... cmd) when setting env vars for `next build` |
| 2026-02-11 | self | Assumed `CONVEX_URL` would always be set inside `--cmd` but it was empty in Vercel logs | Use `--cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL` and reference that explicitly; export it for `next build` |
| 2026-02-11 | self | Vercel `buildCommand` schema max length 256 chars | Move long logic into a script and keep `buildCommand` short |
| 2026-02-11 | self | `set -u` caused failure because `$NEXT_PUBLIC_CONVEX_URL` expanded in the outer script, not inside `--cmd` | Escape `$` in the `--cmd` string so it expands in the Convex-invoked shell |
