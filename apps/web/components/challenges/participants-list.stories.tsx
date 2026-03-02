import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ParticipantsList } from "./participants-list";

const meta: Meta<typeof ParticipantsList> = {
  title: "Challenges/ParticipantsList",
  component: ParticipantsList,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockParticipants = [
  {
    id: "user-1",
    username: "sarahc",
    name: "Sarah Chen",
    avatarUrl: null,
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "user-2",
    username: "miket",
    name: "Mike Torres",
    avatarUrl: null,
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "user-3",
    username: "janesmith",
    name: "Jane Smith",
    avatarUrl: null,
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: "user-4",
    username: "alexj",
    name: "Alex Johnson",
    avatarUrl: null,
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: "user-5",
    username: "chrisl",
    name: "Chris Lee",
    avatarUrl: null,
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
  },
];

export const Default: Story = {
  args: {
    challengeId: "challenge-1",
    participants: mockParticipants,
    totalCount: 264,
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
};

export const FewParticipants: Story = {
  args: {
    challengeId: "challenge-1",
    participants: mockParticipants.slice(0, 2),
    totalCount: 2,
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
    challengeId: "challenge-1",
    participants: [],
    totalCount: 0,
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
};
