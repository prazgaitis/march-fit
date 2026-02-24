# 2026-02-24 - Sentry context enrichment

## Todos
- [x] Audit current Sentry capture callsites (web + backend)
- [x] Add shared helper for consistent context tags/extras
- [x] Attach user/challenge/function/request context where available
- [x] Verify typecheck/lint for touched files
- [x] Document usage notes

## Notes
- Added shared web helper `apps/web/lib/sentry.ts` to enforce common tags (`area`, `pathname`, `host`) and optional `challengeId` + `userId` metadata.
- Updated existing web capture callsites (`activity-feed`, `convex-provider`, `global-error`) to use shared helper and include structured context.
- Extended backend Sentry envelope utility in `packages/backend/lib/latencyMonitoring.ts` with a generic `reportBackendSentryEvent` helper carrying operation/challenge/user/deployment metadata.
- `queries/challenges:getByIdWithCount` now reports malformed ID inputs (sampled warning at 10%) with `rawChallengeId` and authenticated `identity.subject` when available.
- Focused lint passes for touched web files. Full typecheck remains blocked by pre-existing Better Auth type mismatch in `packages/backend/auth.ts`.
