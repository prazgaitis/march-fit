import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PartnerWeekCard } from "./partner-week-card";

const meta: Meta<typeof PartnerWeekCard> = {
  title: "Mini-Games/PartnerWeekCard",
  component: PartnerWeekCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

const threeDaysFromNow = Date.now() + 3 * 24 * 60 * 60 * 1000;

export const Default: Story = {
  args: {
    gameName: "Partner Week",
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    partner: {
      id: "user-2",
      name: "Sarah Chen",
      username: "sarahc",
      avatarUrl: null,
    },
    initialState: { rank: 5, points: 100 },
    partnerCurrentPoints: 250,
    bonusPercentage: 10,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};

export const HighBonus: Story = {
  args: {
    gameName: "Partner Week",
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    partner: {
      id: "user-3",
      name: "Mike Torres",
      username: "miket",
      avatarUrl: null,
    },
    initialState: { rank: 12, points: 50 },
    partnerCurrentPoints: 500,
    bonusPercentage: 10,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};

export const NoPartnerActivity: Story = {
  args: {
    gameName: "Partner Week",
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    partner: {
      id: "user-4",
      name: "Alex Johnson",
      username: "alexj",
      avatarUrl: null,
    },
    initialState: { rank: 8, points: 200 },
    partnerCurrentPoints: 200,
    bonusPercentage: 10,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};

export const NoPartner: Story = {
  args: {
    gameName: "Partner Week",
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    partner: null,
    initialState: {},
    partnerCurrentPoints: null,
    bonusPercentage: 10,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};
