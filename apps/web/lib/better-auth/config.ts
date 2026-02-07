import "server-only";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function stripAuthPath(value: string) {
  return value.replace(/\/api\/auth\/?$/, "");
}

export function getBetterAuthOrigin() {
  const origin =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  return stripTrailingSlash(stripAuthPath(origin));
}

export function getBetterAuthBasePath() {
  return "/api/auth";
}

export function getBetterAuthBaseUrl() {
  return `${getBetterAuthOrigin()}${getBetterAuthBasePath()}`;
}
