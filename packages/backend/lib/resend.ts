import { Resend } from "@convex-dev/resend";
import { components } from "../_generated/api";

export const resend = new Resend(components.resend, {
  // Set testMode: false in production to send real emails
  // In test mode, only emails to *@resend.dev are allowed
  testMode: false,
});
