import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { ConvexProviderWrapper } from "@/components/providers/convex-provider";
import { ConditionalHeader } from "@/components/layout/conditional-header";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getToken, preloadAuthQuery } from "@/lib/server-auth";
import { api } from "@repo/backend";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "March Fitness - Challenge Yourself",
  description: "Join fitness challenges, track your progress, and compete with friends",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const layoutStart = performance.now();
  const [token, preloadedUser] = await Promise.all([
    getToken(),
    preloadAuthQuery(api.queries.users.current),
  ]);
  console.log(`[perf] layout auth: ${Math.round(performance.now() - layoutStart)}ms`);

  return (
    <ConvexProviderWrapper initialToken={token ?? null}>
      <html lang="en">
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        {process.env.NODE_ENV === "development" && (
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
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
              <div className="absolute -left-20 -top-40 h-96 w-96 rounded-full bg-indigo-500/20 blur-[120px]" />
              <div className="absolute bottom-0 right-0 h-80 w-80 translate-x-1/4 translate-y-1/4 rounded-full bg-fuchsia-500/15 blur-[100px]" />
            </div>
            <ConditionalHeader preloadedUser={preloadedUser} />
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
