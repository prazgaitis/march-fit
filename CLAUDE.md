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
# Run tests
pnpm test -- --run
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

## Date Handling (Local Date Semantics)

Daily totals and challenge windows are based on the user's local calendar date.
`activities.loggedDate` is stored as a date-only value (UTC ms for the local date),
and Strava uses `start_date_local` to derive that date. Do not use time-of-day when
grouping daily totals. Prefer `formatDateOnlyFromUtcMs(loggedDate)` for rollups.

The client must send a local date (or a local timestamp plus timezone) for activity logging.
The backend should normalize to a date-only value and must not infer a local date from UTC alone.
