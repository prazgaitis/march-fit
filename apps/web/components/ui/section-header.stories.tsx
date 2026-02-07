import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SectionHeader } from "./section-header";

const meta: Meta<typeof SectionHeader> = {
  title: "UI/SectionHeader",
  component: SectionHeader,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: {
    children: "Top Performers",
    size: "sm",
  },
};

export const Medium: Story = {
  args: {
    children: "Challenge Settings",
    size: "md",
  },
};

export const InContext: Story = {
  render: () => (
    <div className="w-64 space-y-4">
      <div className="rounded border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-3 py-2">
          <SectionHeader>Leaderboard</SectionHeader>
        </div>
        <div className="p-3">
          <div className="text-sm text-zinc-300">Content goes here...</div>
        </div>
      </div>
    </div>
  ),
};
