'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, Link2, Unplug } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '@repo/backend';
import type { Id } from '@repo/backend/_generated/dataModel';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface IntegrationMetadata {
  id: string;
  name: string;
  description: string;
  features: string[];
  docsUrl: string;
}

export interface IntegrationConnection {
  id: string;
  service: string;
  createdAt: string;
  updatedAt: string;
  revoked: boolean | null;
  expiresAt: string | null;
}

interface IntegrationCardProps {
  integration: IntegrationMetadata;
  connection?: IntegrationConnection | null;
}

export function IntegrationCard({
  integration,
  connection: initialConnection,
}: IntegrationCardProps) {
  const [connection, setConnection] = useState<IntegrationConnection | null>(
    initialConnection ?? null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useMutation(api.mutations.integrations.connect);
  const disconnect = useMutation(api.mutations.integrations.disconnect);

  const handleConnect = async () => {
    if (integration.id === 'strava') {
      const successUrl = encodeURIComponent('/integrations?success=strava_connected');
      const errorUrl = encodeURIComponent('/integrations?error=strava_auth_failed');
      window.location.href = `/api/strava/connect?successUrl=${successUrl}&errorUrl=${errorUrl}`;
      return;
    }

    // Fallback for other integrations (Apple Health)
    const code = window.prompt(
      `Enter the authorization code for ${integration.name}`,
      'demo-code',
    );

    if (!code) {
      return;
    }

    try {
      setPending(true);
      setError(null);

      // Call Convex mutation
      const result = await connect({
          service: integration.id as "strava" | "apple_health",
          code,
      });

      if (result) {
          setConnection({
              id: result._id,
              service: result.service,
              createdAt: new Date(result.createdAt).toISOString(),
              updatedAt: new Date(result.updatedAt).toISOString(),
              revoked: result.revoked,
              expiresAt: result.expiresAt ? new Date(result.expiresAt).toISOString() : null,
          });
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : 'Unable to connect integration',
      );
    } finally {
      setPending(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;

    if (!window.confirm(`Disconnect ${integration.name}?`)) {
      return;
    }

    try {
      setPending(true);
      setError(null);
      
      await disconnect({
          integrationId: connection.id as Id<"userIntegrations">,
      });

      setConnection(null);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to disconnect integration',
      );
    } finally {
      setPending(false);
    }
  };

  const statusLabel = connection
    ? `Connected ${formatDistanceToNow(new Date(connection.createdAt), {
        addSuffix: true,
      })}`
    : 'Not connected';

  return (
    <Card
      className={cn(
        'flex h-full flex-col justify-between border border-zinc-800 bg-zinc-900/50 shadow-sm transition hover:border-zinc-700 hover:shadow-md',
        connection && 'border-emerald-500/30 bg-emerald-500/5 ring-1 ring-emerald-500/20',
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-semibold text-white">
              {integration.name}
            </CardTitle>
            <p className="mt-1 text-sm text-zinc-400">
              {integration.description}
            </p>
          </div>
          {connection ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" aria-hidden />
          ) : (
            <Link2 className="h-6 w-6 text-zinc-600" aria-hidden />
          )}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {statusLabel}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
          <p className="text-xs uppercase text-zinc-500">
            Highlights
          </p>
          <ul className="list-disc space-y-1 pl-5 text-zinc-400">
            {integration.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {connection ? (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={handleDisconnect}
              className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            >
              <Unplug className="mr-2 h-4 w-4" /> Disconnect
            </Button>
          ) : (
            <Button disabled={pending} onClick={handleConnect} className="bg-white text-black hover:bg-zinc-200">
              <Link2 className="mr-2 h-4 w-4" /> Connect
            </Button>
          )}
          <Button
            variant="ghost"
            asChild
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <a href={integration.docsUrl} target="_blank" rel="noreferrer">
              View setup guide
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
