import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./card";
import { Button } from "./button";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description with supporting text.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Card content goes here. This is a basic card layout with header,
          content, and footer sections.
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Save</Button>
      </CardFooter>
    </Card>
  ),
};

export const Simple: Story = {
  render: () => (
    <Card className="w-[300px]">
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">
          A simple card with just content and no header.
        </p>
      </CardContent>
    </Card>
  ),
};

export const ChallengeStatsCard: Story = {
  render: () => (
    <Card className="w-[350px] border-zinc-800 bg-transparent">
      <CardHeader>
        <div className="text-xs uppercase tracking-wide text-zinc-500">Status</div>
        <CardTitle className="text-2xl font-bold text-white">12,450 total points</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="text-zinc-500">My streak</div>
          <p className="mt-2 text-xl font-semibold text-white">7</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="text-zinc-500">Participants</div>
          <p className="mt-2 text-xl font-semibold text-white">264</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="text-zinc-500">Days remaining</div>
          <p className="mt-2 text-xl font-semibold text-white">14</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="text-zinc-500">Your rank</div>
          <p className="mt-2 text-xl font-semibold text-white">#5</p>
        </div>
      </CardContent>
    </Card>
  ),
};

export const EmptyState: Story = {
  render: () => (
    <Card className="w-[400px] border-dashed text-center">
      <CardHeader>
        <CardTitle>No activity yet</CardTitle>
        <CardDescription>
          Be the first to log a workout for this challenge.
        </CardDescription>
      </CardHeader>
    </Card>
  ),
};
