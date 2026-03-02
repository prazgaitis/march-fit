import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { UserAvatarInline } from "./user-avatar";

const mockUser = {
  id: "user-1",
  name: "Jane Smith",
  username: "janesmith",
  avatarUrl: null,
  location: "San Francisco, CA",
};

const meta: Meta<typeof UserAvatarInline> = {
  title: "Data Display/UserAvatarInline",
  component: UserAvatarInline,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg", "xl", "2xl"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    user: mockUser,
  },
};

export const WithSuffix: Story = {
  args: {
    user: mockUser,
    suffix: (
      <>
        <span aria-hidden="true">·</span>
        <span className="text-sm">2 hours ago</span>
      </>
    ),
  },
};

export const SmallSize: Story = {
  args: {
    user: mockUser,
    size: "sm",
    suffix: (
      <>
        <span aria-hidden="true">·</span>
        <span className="text-sm">just now</span>
      </>
    ),
  },
};

export const FeedCardHeader: Story = {
  render: () => (
    <div className="w-[400px] rounded-lg border border-border p-4">
      <UserAvatarInline
        user={mockUser}
        size="lg"
        suffix={
          <>
            <span aria-hidden="true">·</span>
            <span className="text-sm">5 hours ago</span>
          </>
        }
      />
      <div className="mt-4">
        <p className="text-sm font-semibold text-primary">Morning Run</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Great 5k run this morning! Feeling energized.
        </p>
      </div>
    </div>
  ),
};
