# MCP Server

> For the full setup guide (Claude, ChatGPT, and other clients), see **[mcp-guide.md](mcp-guide.md)**.
> For admin workflows (flagged activities, activity types, announcements), see **[admin-guide.md](admin-guide.md)**.

March Fit exposes a remote MCP endpoint from the web app:

- **URL:** `https://www.march.fit/api/mcp`
- **Transport:** Streamable HTTP
- **Auth:** `?token=mf_...` URL parameter, or `Authorization: Bearer mf_...` header

## Quick Start

**Claude.ai / Claude Desktop / ChatGPT** — use the URL with token parameter:
```
https://www.march.fit/api/mcp?token=mf_YOUR_API_KEY
```

**Claude Code (CLI)** — supports headers natively:
```bash
claude mcp add --transport http march-fit https://www.march.fit/api/mcp \
  --header "Authorization: Bearer mf_..."
```

## Available Tools

### User Tools

| Tool | Description |
|------|-------------|
| `me` | Current user profile + challenges |
| `list_challenges` | List accessible challenges |
| `get_challenge` | Get single challenge details |
| `challenge_leaderboard` | Leaderboard by challengeId |
| `list_activities` | Challenge activity feed |
| `list_activity_types` | Activity types with scoring config |
| `list_participants` | Participants with roles and scores |
| `log_activity` | Create activity in a challenge |
| `get_activity` | Get single activity details |
| `delete_activity` | Delete own activity |

### Admin Tools

| Tool | Description |
|------|-------------|
| `update_challenge` | Update challenge settings |
| `set_announcement` | Set/clear announcement banner |
| `update_participant_role` | Change participant role |
| `list_flagged_activities` | List flagged activities |
| `get_flagged_activity` | Flagged activity details + history |
| `resolve_flagged_activity` | Resolve or re-open a flag |
| `add_admin_comment` | Comment on a flagged activity |
| `admin_edit_activity` | Edit any activity |
| `create_activity_type` | Create a new activity type |
| `update_activity_type` | Modify an activity type |

## Getting an API Key

1. Sign in at [march.fit](https://march.fit) and open your **Profile** page.
2. Scroll to the **API Access** section.
3. Click **Create API Key** and give it a name (e.g. "Claude Desktop").
4. Copy the key immediately — it starts with `mf_` and is only shown once.
5. Use it as `?token=mf_...` in the URL, or `Authorization: Bearer mf_...` in a header.

## Local Development

```bash
# web app runs on 3001 in this repo
http://localhost:3001/api/mcp
```

Use an API key from the March Fit profile page (`API Access` section), or from `mf config`.
