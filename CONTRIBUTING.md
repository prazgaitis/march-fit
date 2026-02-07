# Contributing to March Fit

Thanks for your interest in contributing.

## Quick Start

```bash
pnpm install
pnpm dev
```

The web app runs at http://localhost:3001.

## Environment

Copy `.env.example` to `.env.local` and fill in required values.

## Development Flow

1. Create a branch from `main`.
2. Make changes with focused commits.
3. Run checks before opening a PR:

```bash
pnpm lint
pnpm typecheck
```

## Convex Notes

- Schema and function changes are pushed when running `pnpm dev`.
- `_generated/` is auto-generated.

## Tests

Project tests are still evolving. If you add functionality, include tests when possible.

## Pull Requests

- Keep PRs focused and small.
- Include screenshots for UI changes.
- Explain any breaking changes clearly.
