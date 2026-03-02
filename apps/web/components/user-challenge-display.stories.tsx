import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { UserChallengeDisplay } from "./user-challenge-display";

const mockUser = {
  id: "user-1",
  name: "Jane Smith",
  username: "janesmith",
  avatarUrl: null,
  location: "San Francisco, CA",
};

const mockUserWithImage = {
  id: "user-2",
  name: "Alex Johnson",
  username: "alexj",
  avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Alex",
  location: "New York, NY",
};

const meta: Meta<typeof UserChallengeDisplay> = {
  title: "Data Display/UserChallengeDisplay",
  component: UserChallengeDisplay,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
    highlight: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    user: mockUser,
    disableLink: true,
  },
};

export const WithLocation: Story = {
  args: {
    user: mockUser,
    show: { name: true, username: true, location: true },
    disableLink: true,
  },
};

export const WithPoints: Story = {
  args: {
    user: mockUser,
    show: { name: true, username: true, points: true },
    points: 1250,
    disableLink: true,
  },
};

export const WithStreak: Story = {
  args: {
    user: mockUser,
    show: { name: true, username: true, streak: true },
    streak: 7,
    disableLink: true,
  },
};

export const FullDisplay: Story = {
  args: {
    user: mockUser,
    show: { name: true, username: true, location: true, points: true, streak: true },
    points: 1250,
    streak: 7,
    disableLink: true,
  },
};

export const Highlighted: Story = {
  args: {
    user: mockUser,
    show: { name: true, username: true, points: true },
    points: 1250,
    highlight: true,
    disableLink: true,
    className: "rounded-lg p-3",
  },
};

export const LeaderboardExample: Story = {
  render: () => (
    <div className="w-[450px] space-y-2">
      {[
        { name: "Sarah Chen", username: "sarahc", points: 2450, streak: 12 },
        { name: "Mike Torres", username: "miket", points: 2100, streak: 8 },
        { name: "Jane Smith", username: "janesmith", points: 1850, streak: 7 },
        { name: "Alex Johnson", username: "alexj", points: 1650, streak: 5 },
        { name: "Chris Lee", username: "chrisl", points: 1200, streak: 3 },
      ].map((user, index) => (
        <div
          key={user.username}
          className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
        >
          <span className="text-lg font-semibold text-zinc-500 w-8">
            #{index + 1}
          </span>
          <div className="flex-1">
            <UserChallengeDisplay
              user={{
                id: `user-${index}`,
                name: user.name,
                username: user.username,
                avatarUrl: null,
              }}
              show={{ name: true, username: true, points: true, streak: true }}
              points={user.points}
              streak={user.streak}
              size="sm"
              highlight={index === 2}
              disableLink
            />
          </div>
        </div>
      ))}
    </div>
  ),
};

export const FeedCardHeader: Story = {
  render: () => (
    <div className="w-[450px] rounded-lg border border-border p-4">
      <UserChallengeDisplay
        user={mockUser}
        size="sm"
        show={{ name: true, username: true, location: true }}
        disableLink
        suffix={
          <>
            <span aria-hidden="true">·</span>
            <span className="text-sm">5 hours ago</span>
          </>
        }
      />
    </div>
  ),
};
