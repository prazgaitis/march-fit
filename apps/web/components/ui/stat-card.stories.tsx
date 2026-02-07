import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatCard } from "./stat-card";
import {
  Activity,
  AlertTriangle,
  Flag,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

const meta: Meta<typeof StatCard> = {
  title: "UI/StatCard",
  component: StatCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    color: {
      control: "select",
      options: ["emerald", "blue", "amber", "purple", "cyan", "zinc", "red", "orange"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "PARTICIPANTS",
    value: 264,
    icon: Users,
    color: "emerald",
  },
};

export const WithSubtext: Story = {
  args: {
    label: "TOTAL POINTS",
    value: "12,450",
    icon: TrendingUp,
    color: "amber",
    subtext: "+15% from last week",
  },
};

export const AllColors: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <StatCard label="EMERALD" value={100} icon={Users} color="emerald" />
      <StatCard label="BLUE" value={200} icon={Activity} color="blue" />
      <StatCard label="AMBER" value={300} icon={TrendingUp} color="amber" />
      <StatCard label="PURPLE" value={400} icon={Zap} color="purple" />
      <StatCard label="CYAN" value={500} icon={Flag} color="cyan" />
      <StatCard label="ZINC" value={600} icon={AlertTriangle} color="zinc" />
    </div>
  ),
};

export const AdminStatsGrid: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="PARTICIPANTS" value={264} icon={Users} color="emerald" />
      <StatCard label="ACTIVITIES" value={1250} icon={Activity} color="blue" />
      <StatCard label="TOTAL POINTS" value={45600} icon={TrendingUp} color="amber" />
      <StatCard label="AVG POINTS" value="172.5" icon={Zap} color="purple" />
      <StatCard label="ACTIVITY TYPES" value={31} icon={Flag} color="cyan" />
      <StatCard label="DAYS ELAPSED" value="15/29" icon={AlertTriangle} color="zinc" />
    </div>
  ),
};

export const NoIcon: Story = {
  args: {
    label: "SIMPLE STAT",
    value: 42,
    color: "amber",
  },
};
