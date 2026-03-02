import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HuntWeekCard } from "./hunt-week-card";

const meta: Meta<typeof HuntWeekCard> = {
  title: "Mini-Games/HuntWeekCard",
  component: HuntWeekCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

const threeDaysFromNow = Date.now() + 3 * 24 * 60 * 60 * 1000;

const mockPrey = {
  id: "user-prey",
  name: "Sarah Chen",
  username: "sarahc",
  avatarUrl: null,
};

const mockHunter = {
  id: "user-hunter",
  name: "Mike Torres",
  username: "miket",
  avatarUrl: null,
};

export const Default: Story = {
  args: {
    gameName: "Hunt Week",
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    prey: mockPrey,
    hunter: mockHunter,
    userCurrentPoints: 500,
    preyCurrentPoints: 550,
    hunterCurrentPoints: 450,
    catchBonus: 75,
    caughtPenalty: 25,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};

export const CaughtPrey: Story = {
  args: {
    gameName: "Hunt Week",
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    prey: mockPrey,
    hunter: mockHunter,
    userCurrentPoints: 600,
    preyCurrentPoints: 550,
    hunterCurrentPoints: 450,
    catchBonus: 75,
    caughtPenalty: 25,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};

export const BeenCaught: Story = {
  args: {
    gameName: "Hunt Week",
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    prey: mockPrey,
    hunter: mockHunter,
    userCurrentPoints: 400,
    preyCurrentPoints: 550,
    hunterCurrentPoints: 500,
    catchBonus: 75,
    caughtPenalty: 25,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};

export const BothCaughtAndCaught: Story = {
  args: {
    gameName: "Hunt Week",
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    prey: mockPrey,
    hunter: mockHunter,
    userCurrentPoints: 600,
    preyCurrentPoints: 550,
    hunterCurrentPoints: 650,
    catchBonus: 75,
    caughtPenalty: 25,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};

export const FirstPlace: Story = {
  args: {
    gameName: "Hunt Week",
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    prey: null,
    hunter: mockHunter,
    userCurrentPoints: 700,
    preyCurrentPoints: null,
    hunterCurrentPoints: 600,
    catchBonus: 75,
    caughtPenalty: 25,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};

export const LastPlace: Story = {
  args: {
    gameName: "Hunt Week",
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    prey: mockPrey,
    hunter: null,
    userCurrentPoints: 300,
    preyCurrentPoints: 350,
    hunterCurrentPoints: null,
    catchBonus: 75,
    caughtPenalty: 25,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};
