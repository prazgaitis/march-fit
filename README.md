# March Fit

March Fit is a fitness challenge platform for hosting multi-week challenges with activities, points, and leaderboards. The hosted service runs at [march.fit](https://march.fit).

This repository contains the full source (web app + backend). Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Features

- **Challenges** — create time-boxed fitness challenges with custom activity types and scoring rules
- **Activity logging** — participants log activities manually or sync from Strava
- **Points & streaks** — configurable point values per activity type with streak bonuses
- **Leaderboards** — real-time rankings updated as activities come in
- **Community feed** — see what other participants are up to
- **Strava sync** — automatic activity import via Strava webhooks
- **Payments** — optional Stripe integration for paid challenges
- **Admin tools** — challenge management, activity moderation, and Strava preview

## Tech Stack

- **Frontend** — Next.js 15, React 19, Tailwind CSS, shadcn/ui
- **Backend** — [Convex](https://convex.dev) (serverless database + functions)
- **Auth** — Better Auth with `@convex-dev/better-auth` adapter
- **Monorepo** — pnpm workspaces + Turborepo

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18.18
- [pnpm](https://pnpm.io/) >= 9

### Setup

```bash
git clone https://github.com/prazgaitis/march-fitness-2026.git
cd march-fitness-2026
pnpm install
cp .env.example .env.local   # fill in required values
pnpm convex:start        # start local Convex containers
pnpm convex:admin-key    # generate admin key → .env.local
pnpm dev
```

The dev server runs:
- Web app: http://localhost:3001
- Convex dashboard: http://localhost:6791

See [docs/hosting.md](docs/hosting.md) for full self-hosting details.

## Repository Layout

```
apps/web/            Next.js frontend
packages/backend/    Convex functions + schema
scripts/             Maintenance & seed scripts
docs/                Architecture and hosting guides
```

## AI-Assisted Development

This repo includes a `CLAUDE.md` with project conventions, commands, and architecture context for use with [Claude Code](https://claude.com/claude-code) and other AI coding tools.

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, conventions, and the PR process.

## License

[MIT](LICENSE)
