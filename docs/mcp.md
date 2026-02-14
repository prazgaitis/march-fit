# MCP Server

March Fit exposes a remote MCP endpoint from the web app:

- URL: `https://www.march.fit/api/mcp`
- Transport: Streamable HTTP
- Auth: `Authorization: Bearer <mf_api_key>`

## Available Tools

- `me` - current user profile + challenges
- `list_challenges` - list accessible challenges
- `challenge_leaderboard` - leaderboard by `challengeId`
- `list_activities` - challenge feed by `challengeId`
- `log_activity` - create activity in a challenge

## Local Development

```bash
# web app runs on 3001 in this repo
http://localhost:3001/api/mcp
```

Use an API key from the March Fit profile page (`API Access` section), or from `mf config`.

## Getting an API Key

1. Open `https://www.march.fit/profile`.
2. Expand the `API Access` section.
3. Create a new API key (name it for your MCP client).
4. Copy the key immediately (it is only shown once).
5. Use it as `Authorization: Bearer mf_...`.

## Claude Code Connection

```bash
claude mcp add --transport http march-fit https://www.march.fit/api/mcp \
  --header "Authorization: Bearer mf_..."
```

For local development, replace with `http://localhost:3001/api/mcp`.
