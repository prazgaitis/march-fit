import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConvexProviderWrapper } from "@/components/providers/convex-provider";
import { ConditionalHeader } from "@/components/layout/conditional-header";
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
  const token = await getToken();
  const preloadedUser = await preloadAuthQuery(api.queries.users.current);

  return (
    <ConvexProviderWrapper initialToken={token ?? null}>
      <html lang="en">
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
        </body>
      </html>
    </ConvexProviderWrapper>
  );
}
