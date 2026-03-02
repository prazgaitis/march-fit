import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StreakCalendarCard } from "./streak-calendar-card";

const meta: Meta<typeof StreakCalendarCard> = {
  title: "Profile/StreakCalendarCard",
  component: StreakCalendarCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Generate mock daily data for March 2026
function generateMockData(options: {
  streakDays: number;
  gapDays?: number[];
  lowPointDays?: string[];
}) {
  const dailyPoints: Record<string, number> = {};
  const dailyStreakCount: Record<string, number> = {};
  let streakCounter = 0;

  for (let day = 1; day <= 31; day++) {
    const key = `2026-03-${String(day).padStart(2, "0")}`;
    const isGap = options.gapDays?.includes(day);
    const isLowPoint = options.lowPointDays?.includes(key);

    if (day <= options.streakDays && !isGap) {
      const pts = isLowPoint ? 2 : 5 + Math.floor(Math.random() * 20);
      dailyPoints[key] = pts;

      if (pts >= 5) {
        streakCounter++;
        dailyStreakCount[key] = streakCounter;
      } else {
        streakCounter = 0;
      }
    } else if (isGap) {
      streakCounter = 0;
    }
  }

  return { dailyPoints, dailyStreakCount };
}

const strongStreak = generateMockData({ streakDays: 28 });
const brokenStreak = generateMockData({ streakDays: 20, gapDays: [8, 9, 15] });
const earlyStreak = generateMockData({ streakDays: 5 });

export const StrongStreak: Story = {
  args: {
    startDate: "2026-03-01",
    endDate: "2026-03-31",
    streakMinPoints: 5,
    dailyPoints: strongStreak.dailyPoints,
    dailyStreakCount: strongStreak.dailyStreakCount,
    totalStreakBonusPoints: 150,
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
};

export const BrokenStreak: Story = {
  args: {
    startDate: "2026-03-01",
    endDate: "2026-03-31",
    streakMinPoints: 5,
    dailyPoints: brokenStreak.dailyPoints,
    dailyStreakCount: brokenStreak.dailyStreakCount,
    totalStreakBonusPoints: 45,
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
};

export const JustStarted: Story = {
  args: {
    startDate: "2026-03-01",
    endDate: "2026-03-31",
    streakMinPoints: 5,
    dailyPoints: earlyStreak.dailyPoints,
    dailyStreakCount: earlyStreak.dailyStreakCount,
    totalStreakBonusPoints: 10,
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
};

export const Empty: Story = {
  args: {
    startDate: "2026-03-01",
    endDate: "2026-03-31",
    streakMinPoints: 5,
    dailyPoints: {},
    dailyStreakCount: {},
    totalStreakBonusPoints: 0,
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
};
