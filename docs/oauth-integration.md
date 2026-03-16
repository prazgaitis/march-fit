# Login with March Fit — OAuth Integration Guide

Build apps that authenticate March Fit users via OAuth 2.0 (Authorization Code + PKCE).

**Base URL:** `https://march.fit` (or `http://localhost:3000` for local dev)

All API endpoints are available at `{BASE_URL}/api/v1/...` — no additional infrastructure URLs needed.

## Quick Start

### 1. Register your app

```bash
curl -X POST https://march.fit/api/v1/oauth/apps \
  -H "Authorization: Bearer mf_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App",
    "redirect_uris": ["https://myapp.com/callback"],
    "scopes": ["profile:read", "challenges:read", "activities:read", "activities:write"]
  }'
```

Response includes `clientId` and `clientSecret` (shown once). For public clients (SPAs, mobile), you only need `clientId` — use PKCE instead of a client secret.

### 2. Redirect user to authorize

```
https://march.fit/api/v1/oauth/authorize?
  response_type=code&
  client_id=mfapp_...&
  redirect_uri=https://myapp.com/callback&
  scope=profile:read+challenges:read+activities:read+activities:write&
  state=RANDOM_CSRF_TOKEN&
  code_challenge=BASE64URL_SHA256_OF_VERIFIER&
  code_challenge_method=S256&
  challenge_id=OPTIONAL_CHALLENGE_ID
```

The user sees a consent screen and clicks "Allow". March Fit redirects back to your `redirect_uri` with `?code=mfac_...&state=...`.

### 3. Exchange code for tokens

```bash
curl -X POST https://march.fit/api/v1/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "mfac_...",
    "redirect_uri": "https://myapp.com/callback",
    "client_id": "mfapp_...",
    "code_verifier": "YOUR_PKCE_VERIFIER"
  }'
```

Response:

```json
{
  "access_token": "mfoauth_...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "mfrt_...",
  "scope": "profile:read challenges:read activities:read activities:write",
  "challenge_id": "CHALLENGE_ID_IF_SCOPED"
}
```

### 4. Call API with token

```bash
curl https://march.fit/api/v1/me \
  -H "Authorization: Bearer mfoauth_..."
```

---

## Scopes

| Scope | Description |
|---|---|
| `profile:read` | Read user profile (name, username, avatar) |
| `challenges:read` | Read challenges the user participates in |
| `activities:read` | Read the user's activities |
| `activities:write` | Log activities on behalf of the user |

---

## Challenge Scoping

Pass `challenge_id` in the authorize URL to scope the token to a single challenge. This is recommended for apps that operate within one challenge context:

- The consent screen shows which challenge the app is requesting access to
- API calls are restricted to that challenge — attempts to access other challenges return 403
- `GET /api/v1/challenges` returns only the scoped challenge

If `challenge_id` is omitted, the token works across all challenges the user participates in.

---

## PKCE (Recommended)

PKCE (Proof Key for Code Exchange) is required for public clients (SPAs, mobile apps) and recommended for all clients. No client secret needed.

```javascript
// 1. Generate verifier + challenge
const verifier = generateRandomString(64);
const challenge = base64url(sha256(verifier));

// 2. Include in authorize URL
// code_challenge=CHALLENGE&code_challenge_method=S256

// 3. Include verifier in token exchange
// code_verifier=VERIFIER
```

---

## API Reference

All endpoints below are relative to the base URL (e.g. `https://march.fit`). Include the access token as `Authorization: Bearer mfoauth_...`.

### User Profile

```
GET /api/v1/me
Scope: profile:read
```

Returns: `{ id, username, email, name, avatarUrl, role, createdAt }`

### Challenges

```
GET /api/v1/challenges
Scope: challenges:read
```

Returns: `{ challenges: [...] }`

```
GET /api/v1/challenges/:id
Scope: challenges:read
```

Returns: `{ challenge: { name, description, startDate, endDate, durationDays, ... } }`

### Activity Types

```
GET /api/v1/challenges/:id/activity-types
Scope: challenges:read
```

Returns: `{ activityTypes: [{ _id, name, description, scoringConfig, ... }] }`

### Leaderboard

```
GET /api/v1/challenges/:id/leaderboard
Scope: challenges:read
```

Returns: `{ leaderboard: [{ username, name, totalPoints, currentStreak, ... }] }`

### Activities

```
GET /api/v1/challenges/:id/activities
Scope: activities:read
Query params: limit (default 20)
```

Returns: `{ page: [...], isDone, continueCursor }`

### Log Activity

```
POST /api/v1/challenges/:id/activities
Scope: activities:write
Content-Type: application/json
```

Body:

```json
{
  "activityTypeId": "ACTIVITY_TYPE_ID",
  "loggedDate": 1710460800000,
  "notes": "optional notes",
  "metrics": { "distance_miles": 3.1 }
}
```

`loggedDate` is UTC milliseconds for the local calendar date (e.g., `Date.UTC(2026, 2, 15)` for March 15, 2026). Use `metrics` to pass activity-specific values like distance or duration — check the activity type's `scoringConfig` for which metrics are expected.

Returns: `{ _id, pointsEarned, ... }`

### Delete Activity

```
DELETE /api/v1/activities/:id
Scope: activities:write
```

### Token Refresh

```
POST /api/v1/oauth/token
Content-Type: application/json
```

```json
{
  "grant_type": "refresh_token",
  "refresh_token": "mfrt_...",
  "client_id": "mfapp_..."
}
```

Access tokens expire after 1 hour. Refresh tokens expire after 30 days. On refresh, both old tokens are revoked and new ones are issued.

### Token Revocation

```
POST /api/v1/oauth/revoke
Content-Type: application/json
```

```json
{ "token": "mfoauth_..." }
```

---

## Token Lifetimes

| Token | Lifetime | Prefix |
|---|---|---|
| Authorization code | 10 minutes (single-use) | `mfac_` |
| Access token | 1 hour | `mfoauth_` |
| Refresh token | 30 days | `mfrt_` |

---

## Example: Full PKCE Flow (JavaScript)

```javascript
const MF_URL = 'https://march.fit'; // or http://localhost:3000
const CLIENT_ID = 'mfapp_...';

// ── Step 1: Generate PKCE and redirect ──
async function login(challengeId) {
  const verifier = randomString(64);
  const challenge = base64url(await sha256(verifier));
  sessionStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: location.href,
    scope: 'profile:read challenges:read activities:read activities:write',
    state: randomString(32),
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  if (challengeId) params.set('challenge_id', challengeId);

  location.href = `${MF_URL}/api/v1/oauth/authorize?${params}`;
}

// ── Step 2: Handle callback and exchange code ──
async function handleCallback() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if (!code) return null;

  const res = await fetch(`${MF_URL}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: location.origin + location.pathname,
      client_id: CLIENT_ID,
      code_verifier: sessionStorage.getItem('pkce_verifier'),
    }),
  });
  return res.json();
}

// ── Step 3: Use the token ──
async function getProfile(accessToken) {
  const res = await fetch(`${MF_URL}/api/v1/me`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  return res.json();
}
```

See `examples/oauth-demo/` for a complete working demo app.
