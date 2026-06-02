import db from "../db.server";
import { planTierFromName } from "../shopify.server";

/**
 * Source-of-truth plan resolver: asks Shopify's Billing API which subscription
 * the merchant currently holds and reduces it to one of the abstract tiers we
 * gate features on ("free" | "growth" | "pro").
 *
 * Use this inside admin loaders/actions where you have a billing context.
 * For non-admin code paths (e.g. the scheduler), read `shop.plan` from the DB
 * instead — that cache is kept fresh via the app_subscriptions/update webhook.
 *
 * Under Shopify Managed Pricing the canonical plan names live in the Partner
 * Dashboard, not in our code — so we deliberately call billing.check() without
 * a `plans` filter (which would otherwise reject any subscription whose name
 * didn't exactly match our local PLANS constant). planTierFromName then maps
 * the live name back to a tier by prefix ("Growth ..." → growth, "Pro ..." →
 * pro), which survives Partner Dashboard renames as long as the prefix holds.
 *
 * @param {import('@shopify/shopify-app-react-router/server').BillingContext} billing
 * @returns {Promise<{tier: 'free'|'growth'|'pro', subscriptionName: string|null, subscriptionId: string|null}>}
 */
export async function resolvePlanTier(billing) {
  const { hasActivePayment, appSubscriptions } = await billing.check();

  if (!hasActivePayment || !appSubscriptions?.length) {
    return { tier: "free", subscriptionName: null, subscriptionId: null };
  }

  // Shopify enforces one active app subscription per shop, so [0] is normally
  // safe. Belt-and-braces: if multiple come back (mid-cycle change race), pick
  // the highest tier so a downgrading merchant doesn't briefly lose Pro perks.
  const rank = { pro: 2, growth: 1, free: 0 };
  const tiers = appSubscriptions
    .map((s) => ({ tier: planTierFromName(s.name), name: s.name, id: s.id }))
    .sort((a, b) => rank[b.tier] - rank[a.tier]);

  return {
    tier: tiers[0].tier,
    subscriptionName: tiers[0].name,
    subscriptionId: tiers[0].id,
  };
}

/**
 * Resolve the merchant's effective plan and refresh the cached value in
 * shop.plan when Shopify reports a paid subscription.
 *
 * Semantics: PROMOTE-ONLY.
 *  - If Shopify reports an active paid subscription (growth/pro), trust it
 *    and write it back to shop.plan. This handles the case where the
 *    merchant just subscribed via Shopify's hosted pricing page and the
 *    app_subscriptions/update webhook hasn't landed yet — by the time they
 *    return to the app, the next loader call promotes the cached value.
 *  - If Shopify reports no active subscription, do NOT overwrite shop.plan.
 *    Downgrades arrive authoritatively via the app_subscriptions/update
 *    webhook (with a CANCELLED / EXPIRED / FROZEN status), which is the
 *    only code path allowed to demote. This means:
 *      (a) a webhook-delayed cancellation briefly keeps paid entitlements
 *          until the webhook catches up — acceptable, usually < 1s;
 *      (b) developers can manually set shop.plan = 'growth' / 'pro' in the
 *          DB for testing without the next page load wiping it out.
 *
 * Always returns the EFFECTIVE tier (i.e. what the gates should respect),
 * combining the live Shopify check and the cached DB value.
 */
export async function syncShopPlan(billing, shopId) {
  const fromShopify = await resolvePlanTier(billing);

  if (fromShopify.tier !== "free") {
    // Real paid subscription — sync the cache.
    await db.shop.update({
      where: { id: shopId },
      data: { plan: fromShopify.tier },
    });
    return fromShopify;
  }

  // No live subscription on Shopify's side — fall back to whatever the cache
  // says. The webhook handler is the only thing that demotes to "free", so a
  // cached "growth"/"pro" value here is either a webhook-not-yet-landed
  // promotion or a dev override; either way we honor it.
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { plan: true },
  });
  return {
    tier: shop?.plan || "free",
    subscriptionName: null,
    subscriptionId: null,
  };
}
