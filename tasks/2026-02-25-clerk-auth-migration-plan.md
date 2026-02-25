# 2026-02-25 - Clerk Auth Migration Plan

## Goal
Replace Better Auth end-to-end with Clerk for web authentication while preserving Convex authorization behavior and existing `users` records.

## Scope
- `apps/web`: auth UI/routes, server auth helpers, providers, middleware/cookies checks
- `packages/backend`: Convex auth provider config and identity mapping
- Infra/config/docs/tests: env vars, CI, runbooks, auth tests

## Plan
- [ ] Finalize target auth architecture (Clerk-hosted UI vs custom UI using Clerk primitives, session token strategy for Convex, redirect model for sign-in/sign-up/sign-out).
- [x] Create a migration branch strategy with feature flag(s) for controlled cutover (`AUTH_PROVIDER=better-auth|clerk` or equivalent).
- [x] Add Clerk dependencies and baseline setup in `apps/web` (`ClerkProvider`, middleware, publishable/secret keys, route protection).
- [x] Replace Better Auth route handler and proxy path (`/api/auth/[...all]`) with Clerk-native flow and remove Better Auth request proxying from `apps/web/lib/server-auth.ts`.
- [x] Replace Better Auth client usage (`betterAuthClient`) in:
- [x] `apps/web/components/auth/better-auth-sign-in.tsx`
- [x] `apps/web/components/auth/better-auth-sign-up.tsx`
- [x] `apps/web/components/auth/forgot-password.tsx`
- [x] `apps/web/components/auth/reset-password.tsx`
- [x] `apps/web/components/auth/sign-out-button.tsx`
- [x] `apps/web/components/auth/user-button.tsx`
- [x] `apps/web/components/dashboard/dashboard-user-menu.tsx`
- [x] Replace Better Auth-backed Convex helpers (`fetchAuthQuery`, `fetchAuthMutation`, `preloadAuthQuery`, `getToken`) with Clerk-backed token retrieval and authenticated Convex client calls.
- [x] Update root layout/header auth preload path:
- [x] Remove Better Auth cookie checks (`better-auth.session_token`, `__Secure-better-auth.session_token`).
- [x] Switch to Clerk server auth checks (session/user from Clerk server utilities).
- [x] Replace `ConvexBetterAuthProvider` in `apps/web/components/providers/convex-provider.tsx` with Clerk-compatible Convex auth provider wiring.
- [x] Replace Convex Better Auth component setup in backend:
- [x] Remove `@convex-dev/better-auth` usage from `packages/backend/auth.ts`, `auth.config.ts`, and `convex.config.ts`.
- [x] Configure Convex auth to trust Clerk-issued JWTs (provider + issuer/audience/JWKS strategy per current Convex/Clerk docs).
- [ ] Preserve `ctx.auth.getUserIdentity()` behavior contract used across existing queries/mutations.
- [ ] Migrate user identity mapping logic:
- [ ] Keep `users` table keyed by internal Convex doc IDs.
- [ ] Update `queries.users.current` / `mutations.users.ensureCurrent` to map Clerk identity fields (`sub`, `email`, name/image fields).
- [ ] Add safeguards for users without email and for duplicate email collisions.
- [ ] Decide password reset ownership:
- [ ] If Clerk handles reset: remove custom reset email logic in `packages/backend/auth.ts`.
- [ ] If custom email reset must remain: design Clerk-compatible reset flow and ownership boundaries.
- [ ] Update OAuth configuration:
- [ ] Move Google OAuth ownership to Clerk dashboard/config.
- [x] Remove Better Auth Google env vars and callback handling paths.
- [ ] Update env/CI/docs:
- [x] Replace `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_BETTER_AUTH_URL`, `GOOGLE_CLIENT_*` references where no longer needed.
- [x] Add Clerk env vars in `.env.example`, scripts, workflows, README/docs/AGENTS notes.
- [x] Remove Better Auth package patching and dependencies:
- [x] Delete `patches/@convex-dev__better-auth@0.10.11.patch` usage and lockfile references.
- [x] Remove Better Auth packages from `apps/web`, `packages/backend`, and root where unused.
- [ ] Update and add tests:
- [ ] Rewrite auth smoke tests and route tests to Clerk flows.
- [ ] Add regression tests for Convex identity sync (`ensureCurrent`) under Clerk claims.
- [ ] Revalidate sign-in/sign-out E2E (existing `2026-02-24` auth e2e coverage).
- [x] Run full verification:
- [x] `pnpm -F web typecheck`
- [x] `pnpm -F web lint`
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [ ] `cd packages/backend && pnpm test` (or repo-standard backend test command)
- [ ] Auth E2E smoke in local + preview deployment
- [ ] Execute phased rollout:
- [ ] Deploy behind auth-provider flag to preview.
- [ ] Run internal user acceptance and admin flow checks.
- [ ] Cut production over and monitor auth/login error rates.
- [ ] Remove Better Auth dead code after stable window.

## Risks To Manage
- Convex token interoperability mismatch (Clerk JWT template/config issues)
- Duplicate-user creation during first Clerk sign-in if identity mapping is not deterministic
- Password reset behavior regressions if ownership changes from custom flow to Clerk-hosted flow
- Session/cookie assumptions in SSR paths causing unexpected anonymous rendering

## Rollback
- Keep rollback playbook to previous known-good deploy while Clerk rollout stabilizes.
- Preserve Convex `users` mapping by email to avoid destructive data migration.
- If severe auth regression occurs, revert deployment and restore previous auth env configuration.
