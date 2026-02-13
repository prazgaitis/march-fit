# Napkin

## Corrections
| Date | Source | What Went Wrong | What To Do Instead |
|------|--------|----------------|-------------------|
| 2026-02-11 | self | Ran `ls` before reading napkin (again) | Always read `.claude/napkin.md` before any other command |
| 2026-02-10 | self | Ran `ls` before reading napkin | Always read `.claude/napkin.md` before any other command |
| 2026-02-10 | self | Used backticks in a shell-quoted PR body so the shell tried to execute `turbo` | Use a heredoc or escape backticks when passing PR bodies to shell commands |
| 2026-02-13 | self | Assumed mobile perf issue was mostly JS parse cost before checking runtime endpoints | Verify browser-facing service URLs (`NEXT_PUBLIC_*`) first; loopback hosts break phone/LAN query paths |
| 2026-02-13 | self | Broke a TS function signature during a broad apply_patch edit | Re-open edited file immediately after structural patches before running full checks |
| 2026-02-13 | self | Ran `sed` on a bracketed path without quoting (`[id]`) and zsh globbed it | Quote paths containing `[]` (e.g., `'apps/web/app/challenges/[id]/dashboard/page.tsx'`) |

## User Preferences
- Hide navbar on full-screen flow pages (invite, dashboard, admin) via `ConditionalHeader` patterns + remove `page-with-header` class
- Avoid LAN-specific runtime rewrites in product code unless explicitly requested

## Patterns That Work
- Convex queries can join related data inline (e.g., activity types + categories in one query)
- `conditional-header.tsx` DASHBOARD_LAYOUT_PATTERNS array controls navbar visibility per route
- Admin console sidebar approach was scrapped — revisit admin nav design in the future
- Mobile feed performance improves by skipping non-critical per-item work (engagement count scans and media URL generation) on initial query
- For mobile perceived performance, SSR the first feed page from server auth and then let client `usePaginatedQuery` take over for realtime/pagination

## Patterns That Don't Work
- Deriving env vars inside `convex deploy --cmd` shell strings — escaping hell, fragile, hard to debug. Instead, derive them in `next.config.ts` which runs at build time and can set `process.env` before Next.js compiles.

## Domain Notes
- Scoring configs have types: distance, duration, count, variant
- `page-with-header` CSS class = `pt-16` to offset fixed navbar
- Seed data lives in `packages/backend/actions/seed.ts`
- Schema changes auto-deploy locally via `pnpm dev`
- Dev-only third-party scripts should be opt-in; avoid `beforeInteractive` for non-critical tooling (e.g., `react-grab`)
| 2026-02-13 | self | Assumed `request.json()` in Convex HTTP actions returned typed JSON; TS now treats it as `unknown` | Add runtime type guards (or explicit schema validation) before accessing webhook payload fields |
- Convex `httpAction` webhook handlers are safer with explicit type guards before deriving event keys (`object_type`, `aspect_type`) from `request.json()`
