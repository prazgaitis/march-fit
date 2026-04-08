# OAuth Demo App

A minimal single-page app demonstrating the "Login with March Fit" OAuth flow.

## What it shows

1. **PKCE-based OAuth login** — no client secret needed
2. **Profile display** — fetching user info via `profile:read` scope
3. **Challenge & leaderboard** — reading challenge data via `challenges:read` scope
4. **Activity logging** — writing activities via `activities:write` scope
5. **Challenge-scoped tokens** — optional scoping to a single challenge
6. **Token revocation** — clean logout

## Setup

1. Register an OAuth app (requires an API key — get one from your profile page):

```bash
curl -X POST http://localhost:3000/api/v1/oauth/apps \
  -H "Authorization: Bearer mf_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "OAuth Demo",
    "redirect_uris": ["http://localhost:8080/"],
    "scopes": ["profile:read", "challenges:read", "activities:read", "activities:write"]
  }'
```

2. Copy the `clientId` from the response.

3. Serve this directory:

```bash
cd examples/oauth-demo
python3 -m http.server 8080
```

4. Open http://localhost:8080, paste your client ID, and click "Login with March Fit".
