# Using March Fit with AI Assistants (MCP)

March Fit supports the **Model Context Protocol (MCP)**, an open standard that lets AI assistants like Claude, ChatGPT, and others interact directly with your March Fit account. Instead of switching to the web app, you can check leaderboards, log activities, review flagged items, and manage challenges through natural conversation.

## What is MCP?

MCP (Model Context Protocol) is a standard created by Anthropic that connects AI assistants to external services. Think of it as giving your AI assistant a set of "tools" it can call on your behalf — in this case, tools for interacting with March Fit.

When MCP is configured, you can say things like:

- "Show me the leaderboard for my fitness challenge"
- "Log a 5-mile run for today"
- "What activities were flagged this week?"

…and the AI will call the March Fit API directly to get the answer or perform the action.

## Prerequisites

1. A March Fit account at [march.fit](https://march.fit)
2. An API key (see [Getting an API Key](#getting-an-api-key) below)
3. An AI assistant that supports MCP

## Getting an API Key

1. Sign in to [march.fit](https://march.fit) and go to your **Profile** page.
2. Scroll to the **API Access** section.
3. Click **Create API Key** and give it a name (e.g. "Claude MCP").
4. Copy the key immediately — it starts with `mf_` and is only shown once.

Keep this key secret. Anyone with it can act as you.

## Connecting to Claude

### Claude Code (CLI)

Run this command in your terminal:

```bash
claude mcp add --transport http march-fit https://www.march.fit/api/mcp \
  --header "Authorization: Bearer mf_YOUR_API_KEY"
```

Claude Code will now have access to all March Fit tools. Try asking: "What challenges am I in?"

### Claude Desktop

1. Open **Settings > MCP Servers** (or find the MCP configuration file).
2. Add a new server with:
   - **Name:** `march-fit`
   - **URL:** `https://www.march.fit/api/mcp`
   - **Transport:** Streamable HTTP
   - **Headers:** `Authorization: Bearer mf_YOUR_API_KEY`

Alternatively, edit the Claude Desktop config file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "march-fit": {
      "url": "https://www.march.fit/api/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer mf_YOUR_API_KEY"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

## Connecting to ChatGPT

ChatGPT supports MCP connections through its Actions interface. The setup varies by plan:

1. In a ChatGPT conversation, open the **GPT settings** or **Actions** panel.
2. Add a new action pointing to `https://www.march.fit/api/mcp`.
3. Set the authentication to **Bearer Token** with your `mf_` API key.

> Note: ChatGPT's MCP support is evolving. Check OpenAI's current documentation for the latest setup steps.

## Connecting to Other MCP Clients

Any client that supports the **Streamable HTTP** transport can connect:

- **Endpoint URL:** `https://www.march.fit/api/mcp`
- **Transport:** Streamable HTTP
- **Authentication:** Bearer token in the `Authorization` header

For clients that don't support custom headers, you can pass the token as a URL parameter:

```
https://www.march.fit/api/mcp?token=mf_YOUR_API_KEY
```

## Available Tools

Once connected, your AI assistant has access to these tools:

### For All Users

| Tool | Description |
|------|-------------|
| `me` | Get your profile and list of enrolled challenges |
| `list_challenges` | List challenges you can see |
| `get_challenge` | Get details for a specific challenge |
| `challenge_leaderboard` | View the leaderboard for a challenge |
| `list_activities` | Browse the activity feed for a challenge |
| `list_activity_types` | See what activity types are available in a challenge |
| `list_participants` | See who's in a challenge |
| `log_activity` | Log a new activity |
| `get_activity` | Get details for a specific activity |
| `delete_activity` | Delete one of your own activities |

### For Challenge Admins

| Tool | Description |
|------|-------------|
| `update_challenge` | Update challenge settings (name, dates, announcement, etc.) |
| `set_announcement` | Set or clear the challenge announcement banner |
| `update_participant_role` | Promote/demote a participant to admin or member |
| `list_flagged_activities` | List activities that have been flagged |
| `get_flagged_activity` | Get details on a specific flagged activity |
| `resolve_flagged_activity` | Resolve or re-open a flagged activity |
| `add_admin_comment` | Add an admin comment to a flagged activity |
| `admin_edit_activity` | Edit any activity (points, date, type, notes) |
| `create_activity_type` | Create a new activity type with scoring rules |
| `update_activity_type` | Update an existing activity type's configuration |

## Example Conversations

**Checking the leaderboard:**

> You: "Who's winning the March challenge?"
>
> AI: *calls `list_challenges` then `challenge_leaderboard`*
>
> "Here's the current leaderboard for March Fitness 2026:
> 1. Alice — 342 pts (12-day streak)
> 2. Bob — 298 pts (8-day streak)
> ..."

**Logging an activity:**

> You: "Log a 3-mile run for today"
>
> AI: *calls `list_activity_types` to find the running type, then `log_activity`*
>
> "Done! Logged a 3-mile run for Feb 15. You earned 15 points (base) + 5 bonus (distance threshold). Your streak is now 7 days."

**Admin — reviewing flags:**

> You: "Show me any pending flagged activities"
>
> AI: *calls `list_flagged_activities` with status "pending"*
>
> "There are 2 pending flagged activities:
> 1. Bob's marathon (Feb 12) — flagged by Alice: 'Seems unusually fast'
> 2. ..."

## Local Development

If you're running March Fit locally, use your local URL instead:

```bash
claude mcp add --transport http march-fit-local http://localhost:3001/api/mcp \
  --header "Authorization: Bearer mf_YOUR_API_KEY"
```

## Troubleshooting

**"Invalid or revoked API key"** — Your key may have been revoked or copied incorrectly. Create a new one from your profile page.

**"Not authorized - challenge admin required"** — The tool you're trying to use requires admin privileges for that challenge. Ask a challenge admin to promote you, or use a non-admin tool instead.

**Tools not appearing** — Make sure the MCP connection is configured with the correct URL and your API key is valid. Try calling the `me` tool first to verify the connection works.

## Further Reading

- [Admin Guide](admin-guide.md) — detailed walkthrough for challenge administrators
- [API & CLI docs](../packages/cli/README.md) — using the `mf` command-line tool
- [Architecture](architecture.md) — how March Fit is built
