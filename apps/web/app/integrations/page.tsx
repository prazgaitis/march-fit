"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@repo/backend";

import {
  IntegrationCard,
  type IntegrationConnection,
  type IntegrationMetadata,
} from "@/components/integrations/integration-card";

const AVAILABLE_INTEGRATIONS: IntegrationMetadata[] = [
  {
    id: "strava",
    name: "Strava",
    description:
      "Import runs, rides, and swims from Strava to automatically track your challenge progress.",
    features: [
      "Automatic activity sync every 15 minutes",
      "Map previews in your activity feed",
      "Supports distance, duration, and elevation metrics",
    ],
    docsUrl: "https://www.strava.com/settings/api",
  },
  {
    id: "apple_health",
    name: "Apple Health",
    description:
      "Sync workouts logged on your Apple Watch, iPhone, or connected health apps.",
    features: [
      "One-tap setup with HealthKit",
      "Real-time workout import",
      "Automatic point calculation for supported activity types",
    ],
    docsUrl: "https://support.apple.com/en-us/HT203037",
  },
];

export default function IntegrationsPage() {
  const router = useRouter();
  const user = useQuery(api.queries.users.current);
  const integrations = useQuery(
    api.queries.integrations.getByUser,
    user ? { userId: user._id } : "skip"
  );

  useEffect(() => {
    if (user === null) {
      router.replace("/sign-in?redirect_url=/integrations");
    }
  }, [router, user]);

  if (!user || integrations === undefined) {
    return <div className="min-h-screen bg-black text-white py-16 text-center">Loading...</div>;
  }

  const connectionsByService = new Map<string, IntegrationConnection>();
  for (const connection of integrations) {
    connectionsByService.set(connection.service, {
      id: connection._id,
      service: connection.service,
      createdAt: new Date(connection.createdAt).toISOString(),
      updatedAt: new Date(connection.updatedAt).toISOString(),
      revoked: connection.revoked,
      expiresAt: connection.expiresAt ? new Date(connection.expiresAt).toISOString() : null,
    });
  }

  return (
    <div className="min-h-screen bg-black text-white page-with-header">
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="container mx-auto px-4 py-12">
            <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-wide text-indigo-400">
                Integrations
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white">
                Connect your fitness data
            </h1>
            <p className="mt-4 text-base text-zinc-400">
                Automatically sync activities from your favourite services to keep
                your challenge dashboard up to date.
            </p>
            </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          {AVAILABLE_INTEGRATIONS.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              connection={connectionsByService.get(integration.id) ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
