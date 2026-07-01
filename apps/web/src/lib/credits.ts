/**
 * Single source of truth for the credit top-up pack (post-cutover hardening).
 *
 * Previously the pack's price lived in three places that drifted: the Stripe
 * checkout charged 990¢, `payments.ts` granted 10 credits, and the buy button
 * hard-coded the label "$4.99". The button now derives its label from here, so
 * the displayed price can never disagree with what Stripe charges again.
 */
export const CREDIT_PACK = {
  /** Credits granted per purchase. */
  credits: 10,
  /** Amount charged, in the smallest currency unit (cents). */
  priceCents: 990,
  /** ISO 4217 currency code for the Stripe line item. */
  currency: "usd",
} as const;

/** Human-readable price label, e.g. "$9.90". */
export const creditPackPriceLabel = (): string =>
  `$${(CREDIT_PACK.priceCents / 100).toFixed(2)}`;
