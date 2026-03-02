import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Textarea } from "./textarea";
import { Label } from "./label";

const meta: Meta<typeof Textarea> = {
  title: "UI/Textarea",
  component: Textarea,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "Type your message...",
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-[400px] gap-1.5">
      <Label htmlFor="notes">Activity Notes</Label>
      <Textarea id="notes" placeholder="How did your workout go?" rows={4} />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    placeholder: "Disabled textarea",
    disabled: true,
  },
};

export const FlagReasonExample: Story = {
  render: () => (
    <div className="grid w-[400px] gap-1.5">
      <Label htmlFor="reason">Reason for report</Label>
      <Textarea
        id="reason"
        placeholder="Add additional context (optional)..."
        rows={3}
        maxLength={2000}
      />
    </div>
  ),
};
