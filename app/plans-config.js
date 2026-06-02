/**
 * Client-safe plan constants.
 *
 * IMPORTANT: This file must stay free of any Node-only imports (no Prisma, no
 * shopify-app-react-router/server, no fs, etc.) because route modules import
 * from it. React Router 7 only auto-strips `loader`, `action`, `middleware`,
 * and `headers` exports from the client bundle — every other route export
 * pulls its full import graph into the browser, and Vite refuses to ship
 * server-only modules to the client.
 *
 * Keep just plain constants + pure functions here. The server-side billing
 * config and the `authenticate` helpers live in `shopify.server.js` and
 * import from this file when they need the same constants.
 */

// Plan names — exact strings Shopify uses in invoices, billing.request() args,
// and app_subscriptions/update webhook payloads. Treat as the canonical key.
export const PLANS = {
  GROWTH_MONTHLY: "Growth Monthly",
  GROWTH_ANNUAL: "Growth Annual",
  PRO_MONTHLY: "Pro Monthly",
  PRO_ANNUAL: "Pro Annual",
};

export const ALL_PAID_PLANS = [
  PLANS.GROWTH_MONTHLY,
  PLANS.GROWTH_ANNUAL,
  PLANS.PRO_MONTHLY,
  PLANS.PRO_ANNUAL,
];

/**
 * Map a Shopify subscription name back to the abstract tier we gate features
 * on. "free" is the absence of any active subscription.
 */
export function planTierFromName(name) {
  if (!name) return "free";
  if (name.startsWith("Pro")) return "pro";
  if (name.startsWith("Growth")) return "growth";
  return "free";
}

/**
 * Test billing in any non-production environment so credit cards are never
 * charged during development or QA. Vite inlines `process.env.NODE_ENV` at
 * build time for the client bundle, so this constant is safe to read in
 * route components as well as in server code.
 */
export const isBillingTestMode = process.env.NODE_ENV !== "production";
