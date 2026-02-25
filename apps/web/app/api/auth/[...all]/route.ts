import { betterAuthHandler } from "@/lib/server-auth";

export const runtime = "nodejs";

export const { GET, POST } = betterAuthHandler;
