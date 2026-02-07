import type { Doc } from "../_generated/dataModel";

export function isPaymentRequired(
  config: Doc<"challengePaymentConfig"> | null | undefined
): boolean {
  if (!config) return false;

  if (config.priceInCents <= 0) {
    return false;
  }

  const hasRequiredKeys = config.testMode
    ? Boolean(config.stripeTestSecretKey && config.stripeTestPublishableKey)
    : Boolean(config.stripeSecretKey && config.stripePublishableKey);

  return hasRequiredKeys;
}
