# Hosting and Self-Hosting

## Hosted Service

The official hosted service is available at https://march.fit.

## Self-Hosting Scope

Self-hosting is supported for development and community use. Some features may require third-party services (Convex, auth providers, Stripe, Strava).

## What You Need

- Node.js 18+
- pnpm 10+
- Convex project (hosted or local Docker)
- Better Auth or Clerk credentials

## Local Convex (Docker)

```bash
pnpm convex:start
pnpm convex:admin-key
pnpm dev:local
```

## Notes

- Production hosting of the official service is managed by the March Fit team.
- For support, use GitHub issues.
