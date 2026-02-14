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
- Local Convex HTTP routes (`httpAction`, `/api/v1/*`) are served from site origin (`127.0.0.1:3211`), not cloud origin (`127.0.0.1:3210`)
- Dev-only third-party scripts should be opt-in; avoid `beforeInteractive` for non-critical tooling (e.g., `react-grab`)
| 2026-02-13 | self | Assumed `request.json()` in Convex HTTP actions returned typed JSON; TS now treats it as `unknown` | Add runtime type guards (or explicit schema validation) before accessing webhook payload fields |
- Convex `httpAction` webhook handlers are safer with explicit type guards before deriving event keys (`object_type`, `aspect_type`) from `request.json()`
- `apps/web` dev script runs `@react-grab/cursor` before `next dev`; this can create behavior differences vs production. Prefer validating layout bugs with `next build && next start` too.
- Overflow debug scripts that add `window.scrollY` to fixed-position elements can produce misleading `top/bottom` values; filter out `position: fixed` when diagnosing document-flow overflow.
- When user asks to branch with dirty worktree, preserve unrelated local modifications and scope edits to requested files only.
| 2026-02-13 | self | Forgot to quote path containing parentheses (`(marketing)`) so zsh globbing failed | Quote paths with `()`, `[]`, and other glob chars in shell commands |
- If user asks to open a PR, commit only task-relevant files and keep unrelated dirty files unstaged.
| 2026-02-13 | self | Used backticks inside a double-quoted `gh pr create --body` string, triggering shell command substitution and noisy side effects | Use a heredoc/file for PR body or avoid backticks in shell-quoted strings |
| 2026-02-14 | self | Tried `bun link --global` for `mf` and it failed in this environment due global Bun metadata state | Prefer repo wrapper + symlink installer script for reliable `mf` invocation without pnpm |
| 2026-02-14 | self | Ran parallel verification commands that both mutated the same config file, creating a race and misleading results | Only parallelize independent commands; run config mutation checks sequentially |
| 2026-02-14 | self | Implemented MCP first as `/api/[transport]` + `withMcpAuth`; valid-token requests returned non-Response at runtime in this Next 16 setup | Prefer explicit `/api/mcp` route with direct Bearer auth wrapper and request-scoped token context for reliability |
| 2026-02-14 | self | Reused a temp config directory during profile verification and got misleading active-profile state | Use a clean temp directory (`rm -rf ...`) for deterministic config-profile tests |
## User Preferences
- Always commit `.claude/napkin.md` with related task commits.
- Avoid module-scope `new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)` in route handlers; lazy-init inside request handlers with env guards to prevent build-time crashes.
- Root layout auth preloads can execute during static prerender (`/_not-found`); guard token preload and fail open when auth env vars are absent at build time.
- Vercel can ignore root `vercel.json` when project Root Directory is `apps/web`; keep an `apps/web/vercel.json` with the Convex deploy build command to avoid accidental `pnpm build` fallback.
- For CLI work in this repo, prefer Bun runtime (`bun ...`) when feasible.
