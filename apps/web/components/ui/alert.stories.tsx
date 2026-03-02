import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Alert, AlertTitle, AlertDescription } from "./alert";
import { AlertCircle, CheckCircle, Info } from "lucide-react";
import { Button } from "./button";
import { RefreshCw } from "lucide-react";

const meta: Meta<typeof Alert> = {
  title: "UI/Alert",
  component: Alert,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Alert className="w-[450px]">
      <Info className="h-4 w-4" />
      <AlertTitle>Information</AlertTitle>
      <AlertDescription>
        Your challenge starts on March 1st. Make sure to log your activities!
      </AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive" className="w-[450px]">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        Failed to load challenge data. Please try refreshing the page.
      </AlertDescription>
    </Alert>
  ),
};

export const Success: Story = {
  render: () => (
    <Alert className="w-[450px] border-emerald-500/30 bg-emerald-500/10">
      <CheckCircle className="h-4 w-4 text-emerald-500" />
      <AlertTitle className="text-emerald-500">Activity logged!</AlertTitle>
      <AlertDescription>
        You earned 15 points for your morning run.
      </AlertDescription>
    </Alert>
  ),
};

export const NewActivityAlert: Story = {
  render: () => (
    <Alert className="w-[450px] border-primary/30 bg-primary/10">
      <AlertTitle className="font-semibold">New activity!</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-2">
        <span>
          Fresh activities have been logged since your last refresh.
        </span>
        <Button size="sm">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh feed
        </Button>
      </AlertDescription>
    </Alert>
  ),
};
