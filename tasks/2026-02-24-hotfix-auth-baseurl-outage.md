# 2026-02-24 - Hotfix auth client base URL outage

## Todos
- [x] Reproduce production outage after PR 84 deploy
- [x] Isolate crashing change causing 500s
- [x] Implement minimal hotfix to restore site
- [x] Validate auth client initialization with valid absolute URL
- [ ] Deploy via PR merge

## Notes
- Production pages (`/`, `/sign-in`) returned HTTP 500 while `/api/auth/*` still responded.
- Root cause: `createAuthClient` was configured with `baseURL: "/api/auth"`, which Better Auth rejects (`Invalid base URL`) and can crash app initialization.
- Hotfix: resolve absolute auth base URL at runtime:
  - browser: `${window.location.origin}/api/auth`
  - server fallback: `NEXT_PUBLIC_BETTER_AUTH_URL` or `NEXT_PUBLIC_APP_URL + /api/auth`.
