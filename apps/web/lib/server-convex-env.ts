import "server-only";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getServerConvexUrl(): string {
  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL");
  }

  return stripTrailingSlash(convexUrl);
}

export function getServerConvexSiteUrl(): string {
  const configuredSiteUrl =
    process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

  if (configuredSiteUrl) {
    return stripTrailingSlash(configuredSiteUrl);
  }

  const convexUrl = getServerConvexUrl();
  if (convexUrl.includes(".convex.cloud")) {
    return convexUrl.replace(".convex.cloud", ".convex.site");
  }

  if (convexUrl.includes(":3210")) {
    return convexUrl.replace(":3210", ":3211");
  }

  return convexUrl;
}
