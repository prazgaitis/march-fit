import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Switch } from "./switch";
import { Label } from "./label";

const meta: Meta<typeof Switch> = {
  title: "UI/Switch",
  component: Switch,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
    checked: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Switch id="notifications" defaultChecked />
      <Label htmlFor="notifications">Enable notifications</Label>
    </div>
  ),
};

export const SettingsExample: Story = {
  render: () => (
    <div className="w-[350px] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="strava">Strava sync</Label>
          <p className="text-xs text-muted-foreground">Auto-import activities</p>
        </div>
        <Switch id="strava" defaultChecked />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="email-notifs">Email notifications</Label>
          <p className="text-xs text-muted-foreground">Weekly summary emails</p>
        </div>
        <Switch id="email-notifs" />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="public">Public profile</Label>
          <p className="text-xs text-muted-foreground">Show on leaderboard</p>
        </div>
        <Switch id="public" defaultChecked />
      </div>
    </div>
  ),
};
