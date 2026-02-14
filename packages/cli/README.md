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
mf --config local config show
mf --config local config set --base-url <url> --challenge <challengeId> --api-key <key>
mf config profiles
mf config use <name>
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
- macOS/Linux: `~/.config/mf/configs/<name>.json`
- Windows: `%APPDATA%/mf/configs/<name>.json`
- If set, `XDG_CONFIG_HOME` is used.
- Active profile name is stored at `~/.config/mf/active-config`.
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

## Profiles (local/prod switching)

Examples:

```bash
# Configure local profile
mf --config local config set --base-url http://127.0.0.1:3211 --api-key mf_local_key

# Configure prod profile
mf --config prod config set --base-url https://www.march.fit --api-key mf_prod_key

# Set default active profile
mf config use prod

# One-off override for a single command
mf --config local me
```

## Verbose Mode

Use `--verbose` (or `-v`) to print resolved environment/request context
(profile, base URL source, API key source, challenge source) before results:

```bash
mf --config local --verbose me
```

## API Key

Resolution order:
1. `--api-key <key>`
2. `MF_API_KEY`
3. `config.apiKey` from active/specified config profile
