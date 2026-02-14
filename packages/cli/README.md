# March Fit CLI (`mf`)

Bun-based CLI for the March Fit HTTP API.

## Install

From repo root:

```bash
pnpm mf:install
```

Then run directly:

```bash
mf --help
```

Without installing to PATH, use:

```bash
./mf --help
```

## Commands

```bash
mf config show
mf config set --base-url <url> --challenge <challengeId> --api-key <key>
mf config clear-challenge
mf config clear-api-key

mf me [--api-key <key>]
mf challenges list [--api-key <key>]
mf activities list [--api-key <key>] [--challenge <challengeId>]
mf activities log [--api-key <key>] --activity-type <id> --date <yyyy-mm-dd> [--challenge <challengeId>]
mf leaderboard [--api-key <key>] [--challenge <challengeId>]
```

## Config

Config is stored at:
- macOS/Linux: `~/.config/mf/config.json`
- Windows: `%APPDATA%/mf/config.json`
- If set, `XDG_CONFIG_HOME` is used.
- Local Convex Docker default API base URL: `http://127.0.0.1:3211/api/v1`

Config shape:

```json
{
  "baseUrl": "https://<deployment>.convex.site/api/v1",
  "challengeId": "<optional default challenge id>",
  "apiKey": "<optional default API key>"
}
```

`--challenge` always overrides `challengeId` from config.

## API Key

Resolution order:
1. `--api-key <key>`
2. `MF_API_KEY`
3. `config.apiKey` from `mf config set --api-key <key>`
