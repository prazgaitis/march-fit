#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const DEFAULT_BASE_URL = "http://127.0.0.1:3211/api/v1";
const DEFAULT_CONFIG_NAME = "default";

function getConfigRootDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return join(process.env.XDG_CONFIG_HOME, "mf");
  }

  if (process.platform === "win32" && process.env.APPDATA) {
    return join(process.env.APPDATA, "mf");
  }

  return join(homedir(), ".config", "mf");
}

function getConfigsDirPath() {
  return join(getConfigRootDir(), "configs");
}

function getLegacyConfigFilePath() {
  return join(getConfigRootDir(), "config.json");
}

function getActiveConfigNamePath() {
  return join(getConfigRootDir(), "active-config");
}

function validateConfigName(name) {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error(
      "Invalid config name. Use only letters, numbers, '.', '_' or '-'."
    );
  }
  return name;
}

function getConfigFilePath(configName) {
  return join(getConfigsDirPath(), `${validateConfigName(configName)}.json`);
}

function normalizeBaseUrl(baseUrl) {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  if (trimmed.endsWith("/api/v1")) {
    return trimmed;
  }
  return `${trimmed}/api/v1`;
}

async function readActiveConfigName() {
  const activePath = getActiveConfigNamePath();
  if (!existsSync(activePath)) {
    return null;
  }

  try {
    const value = (await readFile(activePath, "utf8")).trim();
    if (!value) {
      return null;
    }
    return validateConfigName(value);
  } catch {
    return null;
  }
}

async function resolveConfigName(explicitConfigName) {
  if (explicitConfigName) {
    return validateConfigName(explicitConfigName);
  }

  if (process.env.MF_CONFIG) {
    return validateConfigName(process.env.MF_CONFIG);
  }

  const active = await readActiveConfigName();
  if (active) {
    return active;
  }

  return DEFAULT_CONFIG_NAME;
}

async function readConfig(configName) {
  const configPath = getConfigFilePath(configName);
  if (!existsSync(configPath)) {
    // Backward compatibility for old single-file config.
    // If profile is default and old config exists, read it.
    if (configName === DEFAULT_CONFIG_NAME) {
      const legacyPath = getLegacyConfigFilePath();
      if (existsSync(legacyPath)) {
        try {
          const raw = await readFile(legacyPath, "utf8");
          const parsed = JSON.parse(raw);
          return {
            baseUrl:
              typeof parsed.baseUrl === "string"
                ? parsed.baseUrl
                : DEFAULT_BASE_URL,
            challengeId:
              typeof parsed.challengeId === "string" ? parsed.challengeId : null,
            apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : null,
          };
        } catch {
          // fall through to defaults
        }
      }
    }

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

async function writeConfig(configName, nextConfig) {
  const configPath = getConfigFilePath(configName);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  return configPath;
}

async function setActiveConfigName(configName) {
  const activePath = getActiveConfigNamePath();
  await mkdir(dirname(activePath), { recursive: true });
  await writeFile(activePath, `${validateConfigName(configName)}\n`, "utf8");
  return activePath;
}

async function listConfigProfiles() {
  const configDir = getConfigsDirPath();
  if (!existsSync(configDir)) {
    return [];
  }

  const entries = await readdir(configDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.slice(0, -5))
    .sort((a, b) => a.localeCompare(b));
}

function resolveApiKey(options, config) {
  if (options["api-key"]) {
    return { apiKey: options["api-key"], source: "flag" };
  }
  if (process.env.MF_API_KEY) {
    return { apiKey: process.env.MF_API_KEY, source: "env:MF_API_KEY" };
  }
  if (config.apiKey) {
    return { apiKey: config.apiKey, source: "profile" };
  }

  throw new Error(
    "Missing API key. Pass --api-key <key>, set MF_API_KEY, or run `mf config set --api-key <key>`."
  );
}

function resolveBaseUrl(options, config) {
  if (options["base-url"]) {
    return {
      baseUrl: normalizeBaseUrl(options["base-url"]),
      source: "flag",
    };
  }
  if (process.env.MF_BASE_URL) {
    return {
      baseUrl: normalizeBaseUrl(process.env.MF_BASE_URL),
      source: "env:MF_BASE_URL",
    };
  }
  if (config.baseUrl) {
    return {
      baseUrl: normalizeBaseUrl(config.baseUrl),
      source: "profile",
    };
  }

  return {
    baseUrl: normalizeBaseUrl(DEFAULT_BASE_URL),
    source: "default",
  };
}

function resolveChallengeId(options, config) {
  if (options.challenge) {
    return { challengeId: options.challenge, source: "flag" };
  }
  if (config.challengeId) {
    return { challengeId: config.challengeId, source: "profile" };
  }
  return { challengeId: null, source: "none" };
}

function maskApiKey(apiKey) {
  if (!apiKey) {
    return "(none)";
  }

  if (apiKey.length <= 11) {
    return apiKey;
  }

  return `${apiKey.slice(0, 11)}...`;
}

function printVerboseRequestInfo({
  verbose,
  profile,
  baseUrl,
  baseUrlSource,
  apiKey,
  apiKeySource,
  challengeId,
  challengeSource,
  operations,
}) {
  if (!verbose) {
    return;
  }

  console.error(`[verbose] profile=${profile}`);
  console.error(`[verbose] baseUrl=${baseUrl} (source=${baseUrlSource})`);
  console.error(
    `[verbose] apiKey=${maskApiKey(apiKey)} (source=${apiKeySource})`
  );
  if (challengeId !== undefined) {
    console.error(
      `[verbose] challengeId=${challengeId ?? "(none)"} (source=${challengeSource ?? "none"})`
    );
  }
  if (operations?.length) {
    console.error(`[verbose] requests=${operations.join(", ")}`);
  }
}

function printHelp() {
  console.log(`mf - March Fit CLI

Usage:
  mf [--config <name>] [--verbose] <command> [options]

Commands:
  mf config show
  mf config set [--base-url <url>] [--challenge <challengeId>] [--api-key <key>]
  mf config profiles
  mf config use <name>
  mf config clear-challenge
  mf config clear-api-key

  mf me [--api-key <key>] [--base-url <url>]
  mf challenges list [--api-key <key>] [--base-url <url>] [--limit <n>] [--offset <n>]

  mf activities list [--challenge <challengeId>] [--api-key <key>] [--base-url <url>] [--limit <n>] [--cursor <cursor>]
  mf activities log --activity-type <id> --date <yyyy-mm-dd> [--metrics <json>] [--notes <text>] [--source <source>] [--challenge <challengeId>] [--api-key <key>] [--base-url <url>]

  mf participants list [--challenge <challengeId>] [--api-key <key>] [--base-url <url>] [--limit <n>] [--offset <n>]
  mf participants set-role --user <userId> --role <member|admin> [--challenge <challengeId>] [--api-key <key>] [--base-url <url>]

  mf leaderboard [--challenge <challengeId>] [--api-key <key>] [--base-url <url>]

  mf forum list [--challenge <challengeId>] [--limit <n>] [--cursor <cursor>]
  mf forum get --post <postId>
  mf forum create --title <title> --content <content> [--parent <postId>] [--challenge <challengeId>]
  mf forum update --post <postId> [--title <title>] [--content <content>]
  mf forum delete --post <postId>
  mf forum upvote --post <postId>
  mf forum pin --post <postId>

Notes:
  - Config profiles are stored at ~/.config/mf/configs/<name>.json (or XDG/APPDATA equivalent)
  - Active config is tracked in ~/.config/mf/active-config
  - Use --config <name> (or MF_CONFIG) to target a specific profile per command
  - Use --verbose (or -v) to print resolved environment/request context
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
    const serverMessage = payload?.error;
    let message;
    if (serverMessage) {
      message = `${serverMessage} (HTTP ${response.status})`;
    } else if (response.status === 401) {
      message = "Unauthorized – check your API key with `mf config show`";
    } else if (response.status === 403) {
      message = "Forbidden – you don't have permission for this action";
    } else if (response.status === 404) {
      message = `Not found – ${url} returned 404. Check your base URL with \`mf config show\``;
    } else {
      message = `Request failed (HTTP ${response.status}): ${url}`;
    }
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

function parseGlobalArgs(argv) {
  const args = [];
  let configName;
  let verbose = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--config" || arg === "-c") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing value for --config");
      }
      configName = next;
      i += 1;
      continue;
    }

    if (arg === "--verbose" || arg === "-v") {
      verbose = true;
      continue;
    }

    if (arg.startsWith("--config=")) {
      configName = arg.slice("--config=".length);
      continue;
    }

    args.push(arg);
  }

  return { args, configName, verbose };
}

async function run() {
  const {
    args: cliArgs,
    configName: globalConfigName,
    verbose,
  } = parseGlobalArgs(
    process.argv.slice(2)
  );
  const [command, subcommand, ...rest] = cliArgs;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const resolvedConfigName = await resolveConfigName(globalConfigName);
  const config = await readConfig(resolvedConfigName);

  if (command === "config") {
    if (subcommand === "show") {
      const activeConfigName = await resolveConfigName();
      const configPath = getConfigFilePath(resolvedConfigName);
      console.log(
        JSON.stringify(
          {
            profile: resolvedConfigName,
            isActive: resolvedConfigName === activeConfigName,
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

    if (subcommand === "profiles") {
      const profiles = await listConfigProfiles();
      const activeConfigName = await resolveConfigName();
      console.log(
        JSON.stringify(
          {
            activeProfile: activeConfigName,
            profiles,
          },
          null,
          2
        )
      );
      return;
    }

    if (subcommand === "use") {
      const { positionals } = parseSubcommandArgs(rest, {});
      const nextConfigName = positionals[0];
      if (!nextConfigName) {
        throw new Error("Usage: mf config use <name>");
      }

      validateConfigName(nextConfigName);
      // Ensure profile exists, creating a default profile file if needed.
      const nextConfig = await readConfig(nextConfigName);
      await writeConfig(nextConfigName, nextConfig);
      const activePath = await setActiveConfigName(nextConfigName);
      console.log(
        `Active config set to '${nextConfigName}' (${activePath})`
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

      const configPath = await writeConfig(resolvedConfigName, nextConfig);
      console.log(`Config '${resolvedConfigName}' updated at ${configPath}`);
      console.log(JSON.stringify(nextConfig, null, 2));
      return;
    }

    if (subcommand === "clear-challenge") {
      const nextConfig = {
        baseUrl: config.baseUrl,
        challengeId: null,
        apiKey: config.apiKey,
      };
      const configPath = await writeConfig(resolvedConfigName, nextConfig);
      console.log(
        `Default challenge cleared in ${configPath} (profile '${resolvedConfigName}')`
      );
      return;
    }

    if (subcommand === "clear-api-key") {
      const nextConfig = {
        baseUrl: config.baseUrl,
        challengeId: config.challengeId,
        apiKey: null,
      };
      const configPath = await writeConfig(resolvedConfigName, nextConfig);
      console.log(
        `API key cleared in ${configPath} (profile '${resolvedConfigName}')`
      );
      return;
    }

    throw new Error(
      "Unknown config command. Use: show, set, profiles, use, clear-challenge, clear-api-key"
    );
  }

  if (command === "me") {
    const { values } = parseSubcommandArgs([subcommand, ...rest].filter(Boolean), {
      "api-key": { type: "string" },
      "base-url": { type: "string" },
    });

    const { apiKey, source: apiKeySource } = resolveApiKey(values, config);
    const { baseUrl, source: baseUrlSource } = resolveBaseUrl(values, config);
    printVerboseRequestInfo({
      verbose,
      profile: resolvedConfigName,
      baseUrl,
      baseUrlSource,
      apiKey,
      apiKeySource,
      operations: ["GET /me", "GET /challenges?limit=100&offset=0"],
    });
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

    const { apiKey, source: apiKeySource } = resolveApiKey(values, config);
    const { baseUrl, source: baseUrlSource } = resolveBaseUrl(values, config);
    printVerboseRequestInfo({
      verbose,
      profile: resolvedConfigName,
      baseUrl,
      baseUrlSource,
      apiKey,
      apiKeySource,
      operations: [
        `GET /challenges?limit=${values.limit ?? 20}&offset=${values.offset ?? 0}`,
      ],
    });
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

    const { challengeId, source: challengeSource } = resolveChallengeId(
      values,
      config
    );
    requireChallengeId(challengeId);

    const { apiKey, source: apiKeySource } = resolveApiKey(values, config);
    const { baseUrl, source: baseUrlSource } = resolveBaseUrl(values, config);
    printVerboseRequestInfo({
      verbose,
      profile: resolvedConfigName,
      baseUrl,
      baseUrlSource,
      apiKey,
      apiKeySource,
      challengeId,
      challengeSource,
      operations: [
        `GET /challenges/${challengeId}/activities?limit=${values.limit ?? 20}${
          values.cursor ? `&cursor=${values.cursor}` : ""
        }`,
      ],
    });

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

    const { challengeId, source: challengeSource } = resolveChallengeId(
      values,
      config
    );
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

    const { apiKey, source: apiKeySource } = resolveApiKey(values, config);
    const { baseUrl, source: baseUrlSource } = resolveBaseUrl(values, config);
    printVerboseRequestInfo({
      verbose,
      profile: resolvedConfigName,
      baseUrl,
      baseUrlSource,
      apiKey,
      apiKeySource,
      challengeId,
      challengeSource,
      operations: [`POST /challenges/${challengeId}/activities`],
    });

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

  if (command === "participants" && subcommand === "list") {
    const { values } = parseSubcommandArgs(rest, {
      challenge: { type: "string" },
      "api-key": { type: "string" },
      "base-url": { type: "string" },
      limit: { type: "string" },
      offset: { type: "string" },
    });

    const { challengeId, source: challengeSource } = resolveChallengeId(values, config);
    requireChallengeId(challengeId);
    const { apiKey, source: apiKeySource } = resolveApiKey(values, config);
    const { baseUrl, source: baseUrlSource } = resolveBaseUrl(values, config);

    printVerboseRequestInfo({
      verbose,
      profile: resolvedConfigName,
      baseUrl, baseUrlSource,
      apiKey, apiKeySource,
      challengeId, challengeSource,
      operations: [`GET /challenges/${challengeId}/participants`],
    });

    const data = await apiRequest({
      baseUrl, apiKey,
      path: `/challenges/${challengeId}/participants`,
      query: { limit: values.limit, offset: values.offset },
    });

    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (command === "participants" && subcommand === "set-role") {
    const { values } = parseSubcommandArgs(rest, {
      user: { type: "string" },
      role: { type: "string" },
      challenge: { type: "string" },
      "api-key": { type: "string" },
      "base-url": { type: "string" },
    });

    if (!values.user) throw new Error("--user is required");
    if (!values.role || !["member", "admin"].includes(values.role)) {
      throw new Error("--role must be 'member' or 'admin'");
    }

    const { challengeId, source: challengeSource } = resolveChallengeId(values, config);
    requireChallengeId(challengeId);
    const { apiKey, source: apiKeySource } = resolveApiKey(values, config);
    const { baseUrl, source: baseUrlSource } = resolveBaseUrl(values, config);

    printVerboseRequestInfo({
      verbose,
      profile: resolvedConfigName,
      baseUrl, baseUrlSource,
      apiKey, apiKeySource,
      challengeId, challengeSource,
      operations: [`PATCH /challenges/${challengeId}/participants/${values.user}`],
    });

    const data = await apiRequest({
      baseUrl, apiKey,
      method: "PATCH",
      path: `/challenges/${challengeId}/participants/${values.user}`,
      body: { role: values.role },
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

    const { challengeId, source: challengeSource } = resolveChallengeId(
      values,
      config
    );
    requireChallengeId(challengeId);

    const { apiKey, source: apiKeySource } = resolveApiKey(values, config);
    const { baseUrl, source: baseUrlSource } = resolveBaseUrl(values, config);
    printVerboseRequestInfo({
      verbose,
      profile: resolvedConfigName,
      baseUrl,
      baseUrlSource,
      apiKey,
      apiKeySource,
      challengeId,
      challengeSource,
      operations: [`GET /challenges/${challengeId}/leaderboard`],
    });

    const data = await apiRequest({
      baseUrl,
      apiKey,
      path: `/challenges/${challengeId}/leaderboard`,
    });

    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (command === "forum") {
    if (subcommand === "list") {
      const { values } = parseSubcommandArgs(rest, {
        challenge: { type: "string" },
        "api-key": { type: "string" },
        "base-url": { type: "string" },
        limit: { type: "string" },
        cursor: { type: "string" },
      });

      const { challengeId, source: challengeSource } = resolveChallengeId(values, config);
      requireChallengeId(challengeId);
      const { apiKey, source: apiKeySource } = resolveApiKey(values, config);
      const { baseUrl, source: baseUrlSource } = resolveBaseUrl(values, config);

      printVerboseRequestInfo({
        verbose,
        profile: resolvedConfigName,
        baseUrl, baseUrlSource,
        apiKey, apiKeySource,
        challengeId, challengeSource,
        operations: [`GET /challenges/${challengeId}/forum`],
      });

      const data = await apiRequest({
        baseUrl, apiKey,
        path: `/challenges/${challengeId}/forum`,
        query: { limit: values.limit, cursor: values.cursor },
      });

      console.log(JSON.stringify(data, null, 2));
      return;
    }

    if (subcommand === "get") {
      const { values } = parseSubcommandArgs(rest, {
        post: { type: "string" },
        "api-key": { type: "string" },
        "base-url": { type: "string" },
      });

      if (!values.post) throw new Error("--post is required");
      const { apiKey } = resolveApiKey(values, config);
      const { baseUrl } = resolveBaseUrl(values, config);

      const data = await apiRequest({
        baseUrl, apiKey,
        path: `/forum-posts/${values.post}`,
      });

      console.log(JSON.stringify(data, null, 2));
      return;
    }

    if (subcommand === "create") {
      const { values } = parseSubcommandArgs(rest, {
        title: { type: "string" },
        content: { type: "string" },
        parent: { type: "string" },
        challenge: { type: "string" },
        "api-key": { type: "string" },
        "base-url": { type: "string" },
      });

      if (!values.content) throw new Error("--content is required");

      const { challengeId } = resolveChallengeId(values, config);
      requireChallengeId(challengeId);
      const { apiKey } = resolveApiKey(values, config);
      const { baseUrl } = resolveBaseUrl(values, config);

      const body = {
        content: values.content,
        title: values.title,
        parentPostId: values.parent,
      };

      const data = await apiRequest({
        baseUrl, apiKey,
        method: "POST",
        path: `/challenges/${challengeId}/forum`,
        body,
      });

      console.log(JSON.stringify(data, null, 2));
      return;
    }

    if (subcommand === "update") {
      const { values } = parseSubcommandArgs(rest, {
        post: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        "api-key": { type: "string" },
        "base-url": { type: "string" },
      });

      if (!values.post) throw new Error("--post is required");
      const { apiKey } = resolveApiKey(values, config);
      const { baseUrl } = resolveBaseUrl(values, config);

      const body = {};
      if (values.title !== undefined) body.title = values.title;
      if (values.content !== undefined) body.content = values.content;

      const data = await apiRequest({
        baseUrl, apiKey,
        method: "PATCH",
        path: `/forum-posts/${values.post}`,
        body,
      });

      console.log(JSON.stringify(data, null, 2));
      return;
    }

    if (subcommand === "delete") {
      const { values } = parseSubcommandArgs(rest, {
        post: { type: "string" },
        "api-key": { type: "string" },
        "base-url": { type: "string" },
      });

      if (!values.post) throw new Error("--post is required");
      const { apiKey } = resolveApiKey(values, config);
      const { baseUrl } = resolveBaseUrl(values, config);

      const data = await apiRequest({
        baseUrl, apiKey,
        method: "DELETE",
        path: `/forum-posts/${values.post}`,
      });

      console.log(JSON.stringify(data, null, 2));
      return;
    }

    if (subcommand === "upvote") {
      const { values } = parseSubcommandArgs(rest, {
        post: { type: "string" },
        "api-key": { type: "string" },
        "base-url": { type: "string" },
      });

      if (!values.post) throw new Error("--post is required");
      const { apiKey } = resolveApiKey(values, config);
      const { baseUrl } = resolveBaseUrl(values, config);

      const data = await apiRequest({
        baseUrl, apiKey,
        method: "POST",
        path: `/forum-posts/${values.post}/upvote`,
      });

      console.log(JSON.stringify(data, null, 2));
      return;
    }

    if (subcommand === "pin") {
      const { values } = parseSubcommandArgs(rest, {
        post: { type: "string" },
        "api-key": { type: "string" },
        "base-url": { type: "string" },
      });

      if (!values.post) throw new Error("--post is required");
      const { apiKey } = resolveApiKey(values, config);
      const { baseUrl } = resolveBaseUrl(values, config);

      const data = await apiRequest({
        baseUrl, apiKey,
        method: "POST",
        path: `/forum-posts/${values.post}/pin`,
      });

      console.log(JSON.stringify(data, null, 2));
      return;
    }

    throw new Error(
      "Unknown forum command. Use: list, get, create, update, delete, upvote, pin"
    );
  }

  throw new Error("Unknown command. Run `mf --help`.");
}

run().catch((error) => {
  if (error?.cause?.code === "ECONNREFUSED" || error?.message?.includes("fetch failed")) {
    const config = loadConfig();
    console.error(`Error: Could not connect to ${config.baseUrl ?? "the API"}. Is the server running?`);
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
});
