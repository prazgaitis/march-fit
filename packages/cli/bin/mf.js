#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const DEFAULT_BASE_URL = "http://127.0.0.1:3211/api/v1";

function getConfigFilePath() {
  if (process.env.XDG_CONFIG_HOME) {
    return join(process.env.XDG_CONFIG_HOME, "mf", "config.json");
  }

  if (process.platform === "win32" && process.env.APPDATA) {
    return join(process.env.APPDATA, "mf", "config.json");
  }

  return join(homedir(), ".config", "mf", "config.json");
}

function normalizeBaseUrl(baseUrl) {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  if (trimmed.endsWith("/api/v1")) {
    return trimmed;
  }
  return `${trimmed}/api/v1`;
}

async function readConfig() {
  const configPath = getConfigFilePath();
  if (!existsSync(configPath)) {
    return { baseUrl: DEFAULT_BASE_URL, challengeId: null, apiKey: null };
  }

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : DEFAULT_BASE_URL,
      challengeId: typeof parsed.challengeId === "string" ? parsed.challengeId : null,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : null,
    };
  } catch {
    return { baseUrl: DEFAULT_BASE_URL, challengeId: null, apiKey: null };
  }
}

async function writeConfig(nextConfig) {
  const configPath = getConfigFilePath();
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  return configPath;
}

function resolveApiKey(options, config) {
  const apiKey = options["api-key"] || process.env.MF_API_KEY || config.apiKey;
  if (!apiKey) {
    throw new Error(
      "Missing API key. Pass --api-key <key>, set MF_API_KEY, or run `mf config set --api-key <key>`."
    );
  }
  return apiKey;
}

function resolveBaseUrl(options, config) {
  const provided = options["base-url"] || process.env.MF_BASE_URL;
  if (provided) {
    return normalizeBaseUrl(provided);
  }
  return normalizeBaseUrl(config.baseUrl || DEFAULT_BASE_URL);
}

function resolveChallengeId(options, config) {
  return options.challenge || config.challengeId || null;
}

function printHelp() {
  console.log(`mf - March Fit CLI

Usage:
  mf <command> [options]

Commands:
  mf config show
  mf config set [--base-url <url>] [--challenge <challengeId>] [--api-key <key>]
  mf config clear-challenge
  mf config clear-api-key

  mf me [--api-key <key>] [--base-url <url>]
  mf challenges list [--api-key <key>] [--base-url <url>] [--limit <n>] [--offset <n>]

  mf activities list [--challenge <challengeId>] [--api-key <key>] [--base-url <url>] [--limit <n>] [--cursor <cursor>]
  mf activities log --activity-type <id> --date <yyyy-mm-dd> [--metrics <json>] [--notes <text>] [--source <source>] [--challenge <challengeId>] [--api-key <key>] [--base-url <url>]

  mf leaderboard [--challenge <challengeId>] [--api-key <key>] [--base-url <url>]

Notes:
  - Config is stored at ~/.config/mf/config.json (or XDG/APPDATA equivalent)
  - baseUrl can be host root or /api/v1 endpoint; /api/v1 is normalized automatically
  - --challenge overrides the configured default challenge
  - API key resolution order: --api-key, MF_API_KEY, config.apiKey
`);
}

function parseSubcommandArgs(args, options) {
  return parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options,
  });
}

async function apiRequest({ baseUrl, apiKey, path, method = "GET", query = null, body = undefined }) {
  const url = new URL(`${baseUrl}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function requireChallengeId(challengeId) {
  if (!challengeId) {
    throw new Error(
      "Missing challenge. Set a default with `mf config set --challenge <id>` or pass --challenge <id>."
    );
  }
}

async function run() {
  const [command, subcommand, ...rest] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const config = await readConfig();

  if (command === "config") {
    if (subcommand === "show") {
      const configPath = getConfigFilePath();
      console.log(
        JSON.stringify(
          {
            path: configPath,
            baseUrl: config.baseUrl,
            challengeId: config.challengeId,
            apiKey: config.apiKey,
          },
          null,
          2
        )
      );
      return;
    }

    if (subcommand === "set") {
      const { values } = parseSubcommandArgs(rest, {
        "base-url": { type: "string" },
        challenge: { type: "string" },
        "api-key": { type: "string" },
      });

      if (!values["base-url"] && !values.challenge && !values["api-key"]) {
        throw new Error("Nothing to set. Provide --base-url, --challenge, and/or --api-key.");
      }

      const nextConfig = {
        baseUrl: values["base-url"]
          ? normalizeBaseUrl(values["base-url"])
          : config.baseUrl,
        challengeId: values.challenge ?? config.challengeId,
        apiKey: values["api-key"] ?? config.apiKey,
      };

      const configPath = await writeConfig(nextConfig);
      console.log(`Config updated at ${configPath}`);
      console.log(JSON.stringify(nextConfig, null, 2));
      return;
    }

    if (subcommand === "clear-challenge") {
      const nextConfig = {
        baseUrl: config.baseUrl,
        challengeId: null,
        apiKey: config.apiKey,
      };
      const configPath = await writeConfig(nextConfig);
      console.log(`Default challenge cleared in ${configPath}`);
      return;
    }

    if (subcommand === "clear-api-key") {
      const nextConfig = {
        baseUrl: config.baseUrl,
        challengeId: config.challengeId,
        apiKey: null,
      };
      const configPath = await writeConfig(nextConfig);
      console.log(`API key cleared in ${configPath}`);
      return;
    }

    throw new Error("Unknown config command. Use: show, set, clear-challenge, clear-api-key");
  }

  if (command === "me") {
    const { values } = parseSubcommandArgs([subcommand, ...rest].filter(Boolean), {
      "api-key": { type: "string" },
      "base-url": { type: "string" },
    });

    const apiKey = resolveApiKey(values, config);
    const baseUrl = resolveBaseUrl(values, config);
    const [meData, challengesData] = await Promise.all([
      apiRequest({ baseUrl, apiKey, path: "/me" }),
      apiRequest({
        baseUrl,
        apiKey,
        path: "/challenges",
        query: { limit: 100, offset: 0 },
      }),
    ]);

    const enrolledChallenges = (challengesData?.challenges || [])
      .filter((challenge) => challenge?.isParticipant !== false)
      .map((challenge) => ({
        id: challenge.id || challenge._id,
        name: challenge.name,
        role: challenge.participantRole || null,
        totalPoints: challenge.participantStats?.totalPoints ?? null,
        currentStreak: challenge.participantStats?.currentStreak ?? null,
      }));

    console.log(
      JSON.stringify(
        {
          ...meData,
          enrolledChallengeCount: enrolledChallenges.length,
          enrolledChallenges,
        },
        null,
        2
      )
    );
    return;
  }

  if (command === "challenges" && subcommand === "list") {
    const { values } = parseSubcommandArgs(rest, {
      "api-key": { type: "string" },
      "base-url": { type: "string" },
      limit: { type: "string" },
      offset: { type: "string" },
    });

    const apiKey = resolveApiKey(values, config);
    const baseUrl = resolveBaseUrl(values, config);
    const data = await apiRequest({
      baseUrl,
      apiKey,
      path: "/challenges",
      query: {
        limit: values.limit,
        offset: values.offset,
      },
    });
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (command === "activities" && subcommand === "list") {
    const { values } = parseSubcommandArgs(rest, {
      challenge: { type: "string" },
      "api-key": { type: "string" },
      "base-url": { type: "string" },
      limit: { type: "string" },
      cursor: { type: "string" },
    });

    const challengeId = resolveChallengeId(values, config);
    requireChallengeId(challengeId);

    const apiKey = resolveApiKey(values, config);
    const baseUrl = resolveBaseUrl(values, config);

    const data = await apiRequest({
      baseUrl,
      apiKey,
      path: `/challenges/${challengeId}/activities`,
      query: {
        limit: values.limit,
        cursor: values.cursor,
      },
    });

    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (command === "activities" && subcommand === "log") {
    const { values } = parseSubcommandArgs(rest, {
      challenge: { type: "string" },
      "activity-type": { type: "string" },
      date: { type: "string" },
      metrics: { type: "string" },
      notes: { type: "string" },
      source: { type: "string" },
      "api-key": { type: "string" },
      "base-url": { type: "string" },
    });

    const challengeId = resolveChallengeId(values, config);
    requireChallengeId(challengeId);

    if (!values["activity-type"]) {
      throw new Error("Missing --activity-type <id>");
    }
    if (!values.date) {
      throw new Error("Missing --date <yyyy-mm-dd>");
    }

    let metrics;
    if (values.metrics) {
      try {
        metrics = JSON.parse(values.metrics);
      } catch {
        throw new Error("Invalid --metrics JSON");
      }
    }

    const apiKey = resolveApiKey(values, config);
    const baseUrl = resolveBaseUrl(values, config);

    const data = await apiRequest({
      baseUrl,
      apiKey,
      method: "POST",
      path: `/challenges/${challengeId}/activities`,
      body: {
        activityTypeId: values["activity-type"],
        loggedDate: values.date,
        metrics,
        notes: values.notes,
        source: values.source,
      },
    });

    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (command === "leaderboard") {
    const { values } = parseSubcommandArgs([subcommand, ...rest].filter(Boolean), {
      challenge: { type: "string" },
      "api-key": { type: "string" },
      "base-url": { type: "string" },
    });

    const challengeId = resolveChallengeId(values, config);
    requireChallengeId(challengeId);

    const apiKey = resolveApiKey(values, config);
    const baseUrl = resolveBaseUrl(values, config);

    const data = await apiRequest({
      baseUrl,
      apiKey,
      path: `/challenges/${challengeId}/leaderboard`,
    });

    console.log(JSON.stringify(data, null, 2));
    return;
  }

  throw new Error("Unknown command. Run `mf --help`.");
}

run().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
