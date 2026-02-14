"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Trash2,
  Plus,
  Key,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function ApiKeySection() {
  const [open, setOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const keys = useQuery(api.queries.apiKeys.listKeys);
  const createKey = useMutation(api.mutations.apiKeys.createKey);
  const revokeKey = useMutation(api.mutations.apiKeys.revokeKey);

  const handleCreate = async () => {
    if (!newKeyName.trim() || creating) return;
    setCreating(true);
    try {
      const result = await createKey({ name: newKeyName.trim() });
      setNewRawKey(result.rawKey);
      setNewKeyName("");
      setShowCreateForm(false);
    } catch (err) {
      console.error("Failed to create API key:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!newRawKey) return;
    await navigator.clipboard.writeText(newRawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    try {
      await revokeKey({ keyId: keyId as any });
    } catch (err) {
      console.error("Failed to revoke API key:", err);
    } finally {
      setRevokingId(null);
    }
  };

  const handleDismissNewKey = () => {
    setNewRawKey(null);
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">API Access</CardTitle>
          </div>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            API keys let you access March Fit from the CLI, MCP servers, or
            custom integrations. Keys are not challenge-scoped &mdash; a single
            key gives access to all your challenges.
          </p>

          {/* Newly created key banner */}
          {newRawKey && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-amber-800">
                New API key created &mdash; copy it now. You won&apos;t see it
                again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white px-3 py-2 text-xs font-mono border select-all break-all">
                  {newRawKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismissNewKey}
                className="text-xs"
              >
                I&apos;ve copied it &mdash; dismiss
              </Button>
            </div>
          )}

          {/* Existing keys list */}
          {keys && keys.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Active keys
              </p>
              {keys.map((key: { id: string; name: string; keyPrefix: string; lastUsedAt?: number; createdAt: number }) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border bg-white p-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {key.keyPrefix}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created{" "}
                      {formatDistanceToNow(new Date(key.createdAt), {
                        addSuffix: true,
                      })}
                      {key.lastUsedAt && (
                        <>
                          {" "}
                          · Last used{" "}
                          {formatDistanceToNow(new Date(key.lastUsedAt), {
                            addSuffix: true,
                          })}
                        </>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={revokingId === key.id}
                    onClick={() => handleRevoke(key.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Create form */}
          {showCreateForm ? (
            <div className="space-y-3 rounded-lg border p-4">
              <Label htmlFor="key-name" className="text-sm">
                Key name
              </Label>
              <Input
                id="key-name"
                placeholder="e.g., CLI, MCP Server, My Script"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                maxLength={64}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!newKeyName.trim() || creating}
                >
                  {creating ? "Creating..." : "Create key"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewKeyName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Create API key
            </Button>
          )}

          {/* Documentation link */}
          <div className="pt-2 border-t">
            <a
              href="https://github.com/prazgaitis/march-fit#api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              API documentation
            </a>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
