import Stripe from 'stripe';

// The installed CJS declarations expose only a call signature, while its runtime
// also supports construction. ESM requires `new`; construction works in both.
const StripeConstructor = Stripe as unknown as new (...args: Parameters<typeof Stripe>) => ReturnType<typeof Stripe>;

export function createStripeClient(apiKey: string) {
  return new StripeConstructor(apiKey, { apiVersion: '2024-04-10' });
}

export type StripeClient = ReturnType<typeof createStripeClient>;
