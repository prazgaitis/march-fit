import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageContainer } from "./page-container";

const meta: Meta<typeof PageContainer> = {
  title: "UI/PageContainer",
  component: PageContainer,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  argTypes: {
    maxWidth: {
      control: "select",
      options: ["sm", "md", "lg", "xl", "2xl", "full"],
    },
    padding: {
      control: "select",
      options: ["none", "sm", "md", "lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    maxWidth: "2xl",
    padding: "md",
    children: (
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="text-zinc-300">
          This content is centered with max-w-2xl and medium padding.
        </div>
      </div>
    ),
  },
};

export const Narrow: Story = {
  args: {
    maxWidth: "md",
    padding: "md",
    children: (
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="text-zinc-300">
          Narrow container with max-w-md.
        </div>
      </div>
    ),
  },
};

export const Wide: Story = {
  args: {
    maxWidth: "xl",
    padding: "lg",
    children: (
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="text-zinc-300">
          Wider container with max-w-xl and large padding.
        </div>
      </div>
    ),
  },
};

export const DashboardExample: Story = {
  args: {
    maxWidth: "2xl",
    padding: "md",
    children: (
      <div className="space-y-4">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="text-lg font-semibold text-zinc-200">Activity Feed</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Recent activities from your challenge participants.
          </p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="text-sm text-zinc-300">Activity item 1...</div>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <div className="text-sm text-zinc-300">Activity item 2...</div>
        </div>
      </div>
    ),
  },
};
