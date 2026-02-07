# Architecture Overview

March Fit is a monorepo with a Next.js frontend and a Convex backend.

## Web App

- Next.js 15 app in `apps/web`
- React 19
- Uses Convex client for data access
- Auth via Better Auth with `@convex-dev/better-auth` adapter

## Backend

- Convex functions in `packages/backend`
- Schema defined in `packages/backend/schema.ts`
- Queries for reads, mutations for writes, actions for external APIs

## Integrations

- Strava webhook integration
- Stripe for payments (per-challenge configuration)
