import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ConvexProviderWrapper } from "@/components/providers/convex-provider";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getToken } from "@/lib/server-auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "March Fitness - Challenge Yourself",
  description: "Join fitness challenges, track your progress, and compete with friends",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "March Fitness",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const enableDevCursorScripts =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_REACT_GRAB === "1";
  const canUseAuth = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  // Only fetch the token if a session cookie exists. getToken() makes a network
  // call to Convex (/api/auth/convex/token) — when there's no session cookie it
  // always 401s and spams Convex logs with Better Auth ERROR entries.
  const cookieStore = await cookies();
  const hasSession = cookieStore.has("better-auth.session_token")
    || cookieStore.has("__Secure-better-auth.session_token");

  let token: string | null = null;
  if (canUseAuth && hasSession) {
    try {
      token = (await getToken()) ?? null;
    } catch (error) {
      console.error("[layout] failed to preload auth token:", error);
    }
  }

  return (
    <ConvexProviderWrapper initialToken={token ?? null}>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} bg-black text-white antialiased`}
        >
          {children}
          <Toaster />
          <Analytics />
          <SpeedInsights />
          {enableDevCursorScripts && (
            <Script
              src="//unpkg.com/react-grab/dist/index.global.js"
              crossOrigin="anonymous"
              strategy="lazyOnload"
            />
          )}
          {enableDevCursorScripts && (
            <Script
              src="//unpkg.com/@react-grab/cursor/dist/client.global.js"
              strategy="lazyOnload"
            />
          )}
        </body>
      </html>
    </ConvexProviderWrapper>
  );
}
