import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PointsDisplay } from "./points-display";

const meta: Meta<typeof PointsDisplay> = {
  title: "UI/PointsDisplay",
  component: PointsDisplay,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "base", "lg", "xl"],
    },
    decimals: {
      control: "select",
      options: [0, 1, 2],
    },
    showSign: { control: "boolean" },
    showLabel: { control: "boolean" },
    hasBonuses: { control: "boolean" },
    isNegative: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    points: 150,
  },
};

export const Positive: Story = {
  args: {
    points: 25,
    showSign: true,
  },
};

export const Negative: Story = {
  args: {
    points: -10,
    isNegative: true,
  },
};

export const WithBonuses: Story = {
  args: {
    points: 42,
    hasBonuses: true,
  },
};

export const WithDecimals: Story = {
  args: {
    points: 12.5,
    decimals: 1,
  },
};

export const NoLabel: Story = {
  args: {
    points: 100,
    showLabel: false,
    showSign: false,
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-baseline gap-4">
      <PointsDisplay points={100} size="sm" />
      <PointsDisplay points={100} size="base" />
      <PointsDisplay points={100} size="lg" />
      <PointsDisplay points={100} size="xl" />
    </div>
  ),
};

export const FeedExample: Story = {
  render: () => (
    <div className="space-y-3 rounded-lg bg-muted p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Morning Run</span>
        <PointsDisplay points={15} size="sm" showSign={false} />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Cycling (bonus!)</span>
        <PointsDisplay points={32} size="sm" showSign={false} hasBonuses />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Rest Day Penalty</span>
        <PointsDisplay points={-5} size="sm" isNegative />
      </div>
    </div>
  ),
};
