# 2026-02-24 - Auth regression (Google sign-in + password reset)

## Todos
- [x] Audit Better Auth config and token/session settings
- [x] Trace Google sign-in callback and token issuance path
- [x] Trace password reset request and token verification path
- [x] Reproduce likely expiry/token mismatch failure in code/tests
- [x] Implement fix and verify with targeted checks
- [x] Document root cause and rollout notes

## Findings
- Root cause is hostname/origin mismatch, not token expiry.
- Repro against prod:
  - `POST https://www.march.fit/api/auth/request-password-reset` with `Origin: https://march.fit` returns `404`.
  - Same request with `Origin: https://www.march.fit` returns `200`.
  - `POST /api/auth/sign-in/social` shows the same split (`march.fit` origin => `404`, `www.march.fit` origin => `200` with Google redirect payload).
- Existing trusted origin derivation in backend used `SITE_URL.replace("://", "://www.")`, which fails when `SITE_URL` is already `https://www.march.fit` (it produces `https://www.www.march.fit` and does not include apex).
- Frontend auth client can resolve to absolute auth origin depending on runtime env; forcing relative `/api/auth` avoids cross-host auth requests.

## Fix
- `apps/web/lib/better-auth/client.ts`: set `baseURL: "/api/auth"` in `createAuthClient`.
- `packages/backend/auth.ts`: replace brittle trusted-origin string replace with robust host normalization that includes both apex and `www`.
- `packages/backend/http.ts`: same robust logic for Better Auth route CORS `allowedOrigins`.
