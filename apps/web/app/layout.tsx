import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { ConvexProviderWrapper } from "@/components/providers/convex-provider";
import { HeaderContent, HeaderSkeleton } from "@/components/layout/header-content";
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
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "March Fitness - Challenge Yourself",
  description: "Join fitness challenges, track your progress, and compete with friends",
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

  // getToken() is fast (cookie read). During static prerender (e.g. /_not-found)
  // auth env vars may be unavailable, so fail open to avoid build-time crashes.
  let token: string | null = null;
  if (canUseAuth) {
    try {
      token = (await getToken()) ?? null;
    } catch (error) {
      console.error("[layout] failed to preload auth token:", error);
    }
  }

  return (
    <ConvexProviderWrapper initialToken={token ?? null}>
      <html lang="en">
      <head>
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
      </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} bg-black text-white antialiased`}
        >
          <div className="relative min-h-screen">
            {canUseAuth && (
              <Suspense fallback={<HeaderSkeleton />}>
                <HeaderContent />
              </Suspense>
            )}
            <div className="relative z-10">
              {children}
            </div>
          </div>
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ConvexProviderWrapper>
  );
}
