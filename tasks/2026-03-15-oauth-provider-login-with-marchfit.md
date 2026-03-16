# Login with March Fit — OAuth 2.0 Provider

**Date:** 2026-03-15
**Description:** Enable third-party apps to authenticate March Fit users and access the API on their behalf via OAuth 2.0, powering a "Login with March Fit" flow.

## Motivation

Third-party developers are building micro-apps (workout guides, custom trackers, leaderboard widgets) on top of March Fit's API and MCP. Currently they rely on user-generated API keys (`mf_*`), which is clunky for end-users and provides no scoped permissions. An OAuth 2.0 provider flow would let apps offer a seamless "Login with March Fit" button — users authorize scopes, and the app gets a token to read/write data on their behalf.

---

## Phase 1: OAuth Application Registry

### Schema — `oauthApps` table

- [x] Add `oauthApps` table to Convex schema
  - `userId` (Id<"users">) — developer who registered the app
  - `name` (string) — app display name
  - `description` (string, optional) — shown on consent screen
  - `iconUrl` (string, optional) — app icon URL
  - `clientId` (string) — public identifier (e.g., `mfapp_<random>`)
  - `clientSecretHash` (string) — SHA-256 of the client secret
  - `clientSecretPrefix` (string) — first 8 chars for display
  - `redirectUris` (string[]) — allowed redirect URIs
  - `scopes` (string[]) — allowed scopes for this app
  - `homepage` (string, optional) — app homepage URL
  - `isActive` (boolean) — soft delete / disable
  - `createdAt` (number)
  - Indexes: `by_clientId`, `by_userId`

### Schema — `oauthAuthorizationCodes` table

- [x] Add `oauthAuthorizationCodes` table
  - `code` (string) — random authorization code
  - `clientId` (string) — which app
  - `userId` (Id<"users">) — who authorized
  - `redirectUri` (string) — must match on token exchange
  - `scopes` (string[]) — granted scopes
  - `codeChallenge` (string, optional) — PKCE
  - `codeChallengeMethod` (string, optional) — "S256"
  - `expiresAt` (number) — short-lived (10 min)
  - `usedAt` (number, optional) — prevent replay
  - Index: `by_code`

### Schema — `oauthAccessTokens` table

- [x] Add `oauthAccessTokens` table
  - `tokenHash` (string) — SHA-256 of the token
  - `tokenPrefix` (string) — first 8 chars for display
  - `clientId` (string) — which app issued this
  - `userId` (Id<"users">) — token owner
  - `scopes` (string[]) — granted scopes
  - `expiresAt` (number) — token expiry (1 hour)
  - `revokedAt` (number, optional)
  - Index: `by_tokenHash`, `by_userId`

### Schema — `oauthRefreshTokens` table

- [x] Add `oauthRefreshTokens` table
  - `tokenHash` (string) — SHA-256
  - `tokenPrefix` (string)
  - `clientId` (string)
  - `userId` (Id<"users">)
  - `scopes` (string[])
  - `expiresAt` (number) — long-lived (30 days)
  - `revokedAt` (number, optional)
  - `accessTokenHash` (string) — associated access token
  - Index: `by_tokenHash`, `by_userId`

---

## Phase 2: OAuth 2.0 Endpoints (Authorization Code + PKCE)

### Authorization Endpoint

- [x] `GET /api/v1/oauth/authorize` — Redirects to consent page
  - Query params: `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, `code_challenge_method`
  - Validates client_id exists and is active
  - Validates redirect_uri is in app's allowed list
  - Validates requested scopes are subset of app's allowed scopes
  - Redirects to frontend consent page with params

### Consent UI (Next.js page)

- [ ] `apps/web/app/oauth/authorize/page.tsx` — consent screen
  - Shows app name, icon, description, requested scopes
  - User clicks "Allow" → POST back to backend
  - User clicks "Deny" → redirect to app with `error=access_denied`

### Authorization Grant

- [x] `POST /api/v1/oauth/authorize` — User approves, generates auth code
  - Authenticated via session (user must be logged in)
  - Creates authorization code record
  - Redirects to `redirect_uri?code=<code>&state=<state>`

### Token Endpoint

- [x] `POST /api/v1/oauth/token` — Exchange code for tokens
  - `grant_type=authorization_code`: validate code, PKCE, issue access + refresh tokens
  - `grant_type=refresh_token`: validate refresh token, issue new access + refresh tokens
  - Client authentication via `client_id` + `client_secret` in body (or Basic auth header)
  - Returns: `{ access_token, token_type: "Bearer", expires_in, refresh_token, scope }`

### Token Revocation

- [x] `POST /api/v1/oauth/revoke` — Revoke a token
  - Accepts `token` + `token_type_hint` (access_token or refresh_token)
  - Revokes the token (and associated refresh token if revoking access token)

---

## Phase 3: Integrate OAuth Tokens into Existing API Auth

- [x] Extend `authenticateRequest()` in httpApi.ts to accept OAuth bearer tokens
  - Check token prefix: `mfoauth_` for OAuth tokens vs `mf_` for API keys
  - Look up `oauthAccessTokens` by hash, verify not expired/revoked
  - Return user + scopes for downstream permission checks

- [x] Add scope-checking middleware
  - Define scopes: `profile:read`, `challenges:read`, `activities:read`, `activities:write`
  - Check endpoint required scopes against token's granted scopes
  - Return 403 if insufficient scope

---

## Phase 4: Developer App Management API

- [x] `POST /api/v1/oauth/apps` — Register a new OAuth app
- [x] `GET /api/v1/oauth/apps` — List developer's registered apps
- [x] `GET /api/v1/oauth/apps/:id` — Get app details
- [x] `PATCH /api/v1/oauth/apps/:id` — Update app settings
- [x] `DELETE /api/v1/oauth/apps/:id` — Deactivate app
- [x] `POST /api/v1/oauth/apps/:id/rotate-secret` — Rotate client secret

---

## Scopes

| Scope | Description |
|---|---|
| `profile:read` | Read user profile info (name, username, avatar) |
| `challenges:read` | Read challenges the user participates in |
| `activities:read` | Read the user's activities |
| `activities:write` | Log activities on behalf of the user |

---

## Phase 5: Challenge Scoping

- [x] Optional `challenge_id` parameter in authorize URL
  - Validates challenge exists during authorization
  - Stored on auth codes, access tokens, and refresh tokens
  - Consent screen shows which challenge the token is scoped to
- [x] API enforcement: challenge-scoped tokens can only access the scoped challenge
  - `GET /api/v1/challenges` returns only the scoped challenge
  - All challenge sub-resource endpoints (activities, leaderboard, activity-types) check scope
  - Returns 403 if token tries to access a different challenge
- [x] Token response includes `challenge_id` when scoped
- [x] Refresh preserves challenge scope

---

## Phase 6: Demo App & Documentation

- [x] `examples/oauth-demo/index.html` — Single-page demo app showing full PKCE flow
  - Login with March Fit button
  - Profile display, challenge info, leaderboard
  - Activity logging
  - Token revocation on logout
- [x] `docs/oauth-integration.md` — Integration guide for coding agents
  - Full API reference with request/response examples
  - PKCE flow walkthrough
  - Challenge scoping documentation

---

## Implementation Notes

- OAuth access tokens use prefix `mfoauth_` to distinguish from API keys (`mf_`)
- Refresh tokens use prefix `mfrt_`
- Authorization codes use prefix `mfac_`
- Client IDs use prefix `mfapp_`
- Client secrets use prefix `mfcs_`
- All secrets stored as SHA-256 hashes, shown once to developer
- PKCE is supported (recommended for public clients like SPAs/mobile)
- Authorization codes expire after 10 minutes and are single-use
- Access tokens expire after 1 hour
- Refresh tokens expire after 30 days
- Consent screen rendered by frontend at `/oauth/authorize`
- Challenge scoping is optional — omitting `challenge_id` gives access to all challenges
