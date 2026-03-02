import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Badge",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Secondary",
  },
};

export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "Destructive",
  },
};

export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Outline",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};

export const ChallengeStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge className="border-transparent bg-green-500/20 text-green-400">Active</Badge>
      <Badge className="border-transparent bg-yellow-500/20 text-yellow-400">Upcoming</Badge>
      <Badge className="border-transparent bg-zinc-500/20 text-zinc-400">Completed</Badge>
    </div>
  ),
};

export const ScoringBadges: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="secondary">3 pts per completion</Badge>
      <Badge variant="secondary">1 pts/mile</Badge>
      <Badge variant="secondary">Tiered scoring</Badge>
    </div>
  ),
};
