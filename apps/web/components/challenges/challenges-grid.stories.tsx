import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChallengesGrid } from "./challenges-grid";

const meta: Meta<typeof ChallengesGrid> = {
  title: "Challenges/ChallengesGrid",
  component: ChallengesGrid,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockChallenges = [
  {
    id: "ch-1",
    name: "March Madness Fitness",
    description:
      "30 days of fitness activities to kick off spring. Log your workouts, compete on the leaderboard!",
    startDate: "2026-03-01",
    endDate: "2026-03-31",
    durationDays: 31,
    participantCount: 264,
  },
  {
    id: "ch-2",
    name: "April Step Challenge",
    description:
      "Walk, run, or hike your way through April. Track your steps and earn points for every mile.",
    startDate: "2026-04-01",
    endDate: "2026-04-30",
    durationDays: 30,
    participantCount: 0,
  },
  {
    id: "ch-3",
    name: "February Freeze",
    description:
      "Stay active through the cold winter months. Bundle up and get moving!",
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    durationDays: 28,
    participantCount: 182,
  },
  {
    id: "ch-4",
    name: "Summer Shred 2026",
    description: null,
    startDate: "2026-06-01",
    endDate: "2026-08-31",
    durationDays: 92,
    participantCount: 45,
  },
];

export const Default: Story = {
  args: {
    challenges: mockChallenges,
  },
};

export const SingleChallenge: Story = {
  args: {
    challenges: [mockChallenges[0]],
  },
};

export const Empty: Story = {
  args: {
    challenges: [],
  },
};

export const LoadError: Story = {
  args: {
    challenges: null,
  },
};
