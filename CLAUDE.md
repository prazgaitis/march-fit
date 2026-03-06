# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Process

Start by adding a new markdown file in the top level /tasks directory. The file should be named with a descriptive slug. The file should have a header with the data and brief description. The PRD should have sections with checkbox-todo's and any implementation notes that get filled out once the work is done. 

## Development Commands

**Start development server (defaults to self-hosted Convex):**
```bash
pnpm dev
```

**Self-hosted Convex setup (Docker):**
```bash
# First time setup (one-time GitHub auth for Docker images):
gh auth token | docker login ghcr.io -u YOUR_USERNAME --password-stdin
pnpm convex:start              # Start local Convex Docker containers
pnpm convex:admin-key          # Generate admin key, copy to root .env.local as CONVEX_SELF_HOSTED_ADMIN_KEY

# Then run (or just pnpm dev):
pnpm dev                       # Runs Next.js + Convex against local Docker

# Other local Convex commands:
pnpm convex:stop               # Stop local Convex containers
pnpm convex:logs               # View Convex container logs
pnpm -F backend seed           # Seed local Convex database
```

**Local Convex endpoints:**
- Backend API: http://127.0.0.1:3210
- HTTP Actions: http://127.0.0.1:3211
- Dashboard: http://localhost:6791

**Build the application:**
```bash
pnpm build
```

**Lint and format:**
```bash
pnpm lint          # Run linting with manypkg check
pnpm lint:fix      # Fix linting issues and run manypkg fix
pnpm format        # Check code formatting
pnpm format:fix    # Fix code formatting
```

**Type checking:**
```bash
pnpm typecheck
```

**Convex database operations:**
```bash
# Local development - seed with fake test data
pnpm db:seed

# Production data management
pnpm db:export-prod    # Export production data to scripts/seed-data/production-data.zip
pnpm db:import-prod    # Import production data (for restoring prod)

# Running functions/queries on prod (use --prod flag)
npx convex run <functionName> '{}' --prod
npx convex data <table> --prod
```

**Testing:**
```bash
# Run unit tests
pnpm test -- --run

# Run E2E tests (requires env vars: E2E_CHALLENGE_ID, E2E_CHALLENGE_INVITE_CODE, E2E_USER_PASSWORD)
pnpm e2e                  # Run Playwright E2E tests (headless)
pnpm e2e:headed           # Run with browser visible
```

**Install shadcn components (run from `apps/web`):**
```bash
pnpm dlx shadcn@latest add input   # Example: add input component inside apps/web
```

## Architecture Overview

This is a fitness challenge platform built as a Turborepo monorepo with:

**Core Structure:**
- `apps/web/` - Next.js 15 frontend with Better Auth and shadcn/ui components
- `packages/backend/` - Convex backend with schema, queries, mutations, and actions
- `e2e/` - Playwright E2E tests that run nightly against production

**Key Data Models:**
- **Users** - Managed by Better Auth with Convex adapter
- **Challenges** - Fitness challenges with start/end dates, scoring rules
- **Activities** - User fitness activities logged to challenges (with points, streaks)
- **Categories** - Activity categorization system
- **Participations** (userChallenges) - User participation in challenges with scores/rankings
- **Activity Types** - Configurable activity types per challenge with point values
- **Template Activity Types** - Reusable activity type templates

**Authentication & Multi-tenancy:**
- Better Auth handles authentication via `@convex-dev/better-auth`
- Challenge-based multi-tenancy (users can participate in multiple challenges)
- Convex queries/mutations handle data operations with auth checks

**External Integrations:**
- Strava webhook for syncing fitness activities
- Stripe for challenge payments (per-challenge config)

**Database:**
- Convex (real-time database with automatic sync)
- Local dev and production deployments are configured via environment variables

## Development Notes

- Uses pnpm workspaces with Turborepo for build orchestration
- Environment variables are shared from root `.env.local` and `.env` files
- shadcn components live in `apps/web/components/ui`
- Convex schema changes are auto-deployed when running `pnpm dev` locally
- Production deploys via Vercel which runs `npx convex deploy` as part of build

## Mini-Games System

Weekly bonus challenges that run within a parent challenge. See `packages/backend/MINI-GAMES.md` for full documentation.

**Three game types:**

- **Partner Week** (`partner_week`) — Rank-based pairing (1st↔last, 2nd↔2nd-last). Each player earns `bonusPercentage`% (default 10%) of their partner's points during the game period.
- **Hunt Week** (`hunt_week`) — Predator-prey chain by rank. Surpass the person above you: `+catchBonus` (default 75). Get surpassed by the person below: `-caughtPenalty` (default 25).
- **PR Week** (`pr_week`) — Beat your highest single-day point total from before the game. Strictly greater than required. Bonus: `+prBonus` (default 100).

**Lifecycle:** `draft` → `active` → `calculating` → `completed`

**Key files:**
- `packages/backend/mutations/miniGames.ts` — Game CRUD, lifecycle, outcome calculation
- `packages/backend/queries/miniGames.ts` — Real-time queries + preview/dry-run
- `packages/backend/lib/miniGameCalculations.ts` — Shared read-only calculation logic for previews
- `packages/backend/mutations/apiMutations.ts` — Internal mutations for HTTP API
- `packages/backend/httpApi.ts` — REST API endpoints (`/api/v1/challenges/:id/mini-games`, `/api/v1/mini-games/:id`)

**API endpoints (admin only for mutations):**
- `GET /api/v1/challenges/:id/mini-games` — List games
- `POST /api/v1/challenges/:id/mini-games` — Create game
- `GET /api/v1/mini-games/:id` — Get game with participants
- `PATCH /api/v1/mini-games/:id` — Update draft game
- `DELETE /api/v1/mini-games/:id` — Delete draft game
- `GET /api/v1/mini-games/:id/preview-start` — **Dry run:** Preview assignments before starting
- `GET /api/v1/mini-games/:id/preview-end` — **Dry run:** Preview scores before ending
- `POST /api/v1/mini-games/:id/start` — **Real run:** Start game (irreversible)
- `POST /api/v1/mini-games/:id/end` — **Real run:** End game (irreversible)

**Important rules:**
- Bonus activities use `source: "mini_game"` and are excluded from game calculations to prevent circular scoring
- PR Week requires strictly greater than (equal does not count)
- All configs are optional; defaults are applied when not provided

## Date Handling (Local Date Semantics)

Daily totals and challenge windows are based on the user's local calendar date.
`activities.loggedDate` is stored as a date-only value (UTC ms for the local date),
and Strava uses `start_date_local` to derive that date. Do not use time-of-day when
grouping daily totals. Prefer `formatDateOnlyFromUtcMs(loggedDate)` for rollups.

The client must send a local date (or a local timestamp plus timezone) for activity logging.
The backend should normalize to a date-only value and must not infer a local date from UTC alone.

## Design Context

### Users
Friend groups competing in fitness challenges for fun and accountability. They check in on mobile and desktop to log activities, trash-talk on the leaderboard, and track streaks. The context is social and competitive — people care about their rank and their friends' activity.

### Brand Personality
**Bold, competitive, edgy.** The brand channels streetwear/athletic energy — high contrast, uppercase type, unapologetic confidence. Think Nike campaign meets dark-mode developer tool. The voice is direct, motivational, and never corporate.

### Emotional Goals
The interface should make users feel **fired up and competitive** — urgency to climb the leaderboard, desire to maintain streaks, rivalry with friends. Every screen should reinforce momentum and progress.

### Aesthetic Direction
- **Dark-first** with light mode support (dark is default, users can switch)
- **High contrast:** Black backgrounds (`bg-black`), white text, vivid accent colors (indigo, fuchsia gradients)
- **Typography:** Geist Sans/Mono, uppercase tracking for labels and headers, bold weight hierarchy
- **Surfaces:** `zinc-900/50` cards with `zinc-800` borders, subtle backdrop blur
- **Buttons:** Pill-shaped (rounded-full) with uppercase tracking on marketing; standard rounded-md shadcn buttons in-app
- **Data presentation:** Bloomberg terminal-inspired stat cards — monospace values, tiny uppercase labels, color-coded icons
- **References:** Strava (social fitness, clean data), Nike Run Club (bold branding, motivational), with a developer-tool precision layer
- **Multiple theme support** via CSS custom properties (Tokyo Night, Retro Synthwave, Emerald, etc.)

### Anti-References
- **No generic SaaS:** Avoid bland dashboards, cookie-cutter card layouts, or corporate blue palettes
- **No sterile/boring UI:** Every screen should have energy and personality — gradients, glow effects, strong type hierarchy

### Design Principles
1. **Competition is visible** — Ranks, streaks, and points should be prominent and feel consequential. Use color, size, and motion to make progress tangible.
2. **Dark and bold** — Embrace the dark palette. Use vivid accents sparingly for emphasis. High contrast is a feature, not a limitation.
3. **Data-dense but scannable** — Show lots of information (stats, leaderboards, activity feeds) but with clear visual hierarchy. Monospace numbers, tiny labels, strong grouping.
4. **Mobile-first energy** — Most users check on their phones. Interfaces should feel native, fast, and tap-friendly. No wasted space.
5. **Personality over polish** — Prefer distinctive design choices (gradient text, glow effects, bold type) over safe, generic patterns. The UI should feel like it belongs to this brand.
