import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardNav } from "./dashboard-nav";

const meta: Meta<typeof DashboardNav> = {
  title: "Dashboard/DashboardNav",
  component: DashboardNav,
  parameters: {
    layout: "centered",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/challenges/challenge-1/dashboard",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    collapsed: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    challengeId: "challenge-1",
    currentUserId: "user-1",
    collapsed: false,
  },
  decorators: [
    (Story) => (
      <div className="w-[280px]">
        <Story />
      </div>
    ),
  ],
};

export const Collapsed: Story = {
  args: {
    challengeId: "challenge-1",
    currentUserId: "user-1",
    collapsed: true,
  },
  decorators: [
    (Story) => (
      <div className="w-[80px]">
        <Story />
      </div>
    ),
  ],
};

export const LeaderboardActive: Story = {
  args: {
    challengeId: "challenge-1",
    currentUserId: "user-1",
  },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/challenges/challenge-1/leaderboard",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[280px]">
        <Story />
      </div>
    ),
  ],
};

export const ProfileActive: Story = {
  args: {
    challengeId: "challenge-1",
    currentUserId: "user-1",
  },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/challenges/challenge-1/users/user-1",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[280px]">
        <Story />
      </div>
    ),
  ],
};
