import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { UserAvatar, UserAvatarInline } from "./user-avatar";

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

// ---------- UserAvatar Stories ----------

const userAvatarMeta: Meta<typeof UserAvatar> = {
  title: "Data Display/UserAvatar",
  component: UserAvatar,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg", "xl", "2xl"],
    },
    showName: { control: "boolean" },
    showUsername: { control: "boolean" },
    disableLink: { control: "boolean" },
  },
};

export default userAvatarMeta;
type Story = StoryObj<typeof userAvatarMeta>;

export const AvatarOnly: Story = {
  args: {
    user: mockUser,
    disableLink: true,
  },
};

export const WithName: Story = {
  args: {
    user: mockUser,
    showName: true,
    disableLink: true,
  },
};

export const WithNameAndUsername: Story = {
  args: {
    user: mockUser,
    showName: true,
    showUsername: true,
    disableLink: true,
  },
};

export const WithImage: Story = {
  args: {
    user: mockUserWithImage,
    showName: true,
    showUsername: true,
    disableLink: true,
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      <UserAvatar user={mockUser} size="sm" disableLink />
      <UserAvatar user={mockUser} size="md" disableLink />
      <UserAvatar user={mockUser} size="lg" disableLink />
      <UserAvatar user={mockUser} size="xl" disableLink />
      <UserAvatar user={mockUser} size="2xl" disableLink />
    </div>
  ),
};

export const WithChildren: Story = {
  args: {
    user: mockUser,
    showName: true,
    showUsername: true,
    disableLink: true,
    children: (
      <p className="text-xs text-muted-foreground/70">Joined 3 days ago</p>
    ),
  },
};

export const Linked: Story = {
  args: {
    user: mockUser,
    challengeId: "challenge-1",
    showName: true,
    showUsername: true,
  },
};
