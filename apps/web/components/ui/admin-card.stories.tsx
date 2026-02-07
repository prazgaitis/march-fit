import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AdminCard } from "./admin-card";
import { SectionHeader } from "./section-header";

const meta: Meta<typeof AdminCard> = {
  title: "UI/AdminCard",
  component: AdminCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    padding: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="text-zinc-300">
        This is the card content. It can contain any content you want.
      </div>
    ),
  },
};

export const WithHeader: Story = {
  args: {
    header: <SectionHeader>Card Title</SectionHeader>,
    children: (
      <div className="text-zinc-300">
        Content with a header section separated by a border.
      </div>
    ),
  },
};

export const SmallPadding: Story = {
  args: {
    padding: "sm",
    children: <div className="text-zinc-300">Small padding content</div>,
  },
};

export const LargePadding: Story = {
  args: {
    padding: "lg",
    children: <div className="text-zinc-300">Large padding content</div>,
  },
};

export const WithComplexContent: Story = {
  args: {
    header: <SectionHeader>Top Performers</SectionHeader>,
    children: (
      <div className="divide-y divide-zinc-800/50">
        {["Alice", "Bob", "Charlie"].map((name, i) => (
          <div key={name} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <span className="w-5 font-mono text-xs text-zinc-600">
                {i + 1}.
              </span>
              <span className="text-sm text-zinc-200">{name}</span>
            </div>
            <span className="font-mono text-xs text-emerald-400">
              {100 - i * 10} pts
            </span>
          </div>
        ))}
      </div>
    ),
  },
};
