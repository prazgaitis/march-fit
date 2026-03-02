import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PrWeekCard } from "./pr-week-card";

const meta: Meta<typeof PrWeekCard> = {
  title: "Mini-Games/PrWeekCard",
  component: PrWeekCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

const threeDaysFromNow = Date.now() + 3 * 24 * 60 * 60 * 1000;
const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;

export const Default: Story = {
  args: {
    gameName: "PR Week",
    startsAt: fiveDaysAgo,
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    initialPr: 45,
    currentWeekMax: 30,
    prBonus: 100,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};

export const CloseToRecord: Story = {
  args: {
    gameName: "PR Week",
    startsAt: fiveDaysAgo,
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    initialPr: 45,
    currentWeekMax: 42,
    prBonus: 100,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};

export const RecordBroken: Story = {
  args: {
    gameName: "PR Week",
    startsAt: fiveDaysAgo,
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    initialPr: 45,
    currentWeekMax: 52,
    prBonus: 100,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};

export const JustStarted: Story = {
  args: {
    gameName: "PR Week",
    startsAt: fiveDaysAgo,
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    initialPr: 45,
    currentWeekMax: 5,
    prBonus: 100,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};

export const NoActivityYet: Story = {
  args: {
    gameName: "PR Week",
    startsAt: fiveDaysAgo,
    endsAt: threeDaysFromNow,
    challengeId: "challenge-1",
    initialPr: 45,
    currentWeekMax: 0,
    prBonus: 100,
  },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
};
