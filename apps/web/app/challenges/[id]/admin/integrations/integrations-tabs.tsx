"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminIntegrationsTable } from "@/components/admin/admin-integrations-table";
import { StravaPreviewClient } from "./strava-preview-client";

type IntegrationsTabsProps = {
  challengeId: string;
  activityTypes: React.ComponentProps<typeof AdminIntegrationsTable>["activityTypes"];
  participantsWithStrava: React.ComponentProps<typeof StravaPreviewClient>["participantsWithStrava"];
};

const tabs = [
  { id: "mappings", label: "Mappings" },
  { id: "test", label: "Test with Participants" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function IntegrationsTabs({
  challengeId,
  activityTypes,
  participantsWithStrava,
}: IntegrationsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("mappings");

  return (
    <div className="space-y-4">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-3 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "text-amber-400"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "mappings" && (
        <Card>
          <CardHeader>
            <CardTitle>Integration Mappings</CardTitle>
            <CardDescription>
              Configure how activities from external services like Strava are mapped to your challenge
              activity types. When users sync activities from connected services, they will
              automatically be logged as the mapped activity type.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminIntegrationsTable
              challengeId={challengeId}
              activityTypes={activityTypes}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "test" && (
        <Card>
          <CardHeader>
            <CardTitle>Strava Activity Preview</CardTitle>
            <CardDescription>
              Select a participant with Strava connected to preview their recent activities
              and see how they would be scored according to your activity type configuration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StravaPreviewClient
              challengeId={challengeId}
              participantsWithStrava={participantsWithStrava}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
