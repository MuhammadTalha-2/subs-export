import { authenticate, planTierFromName } from "../shopify.server";
import db from "../db.server";

/**
 * app_subscriptions/update webhook.
 *
 * Shopify fires this whenever the merchant's app subscription changes state —
 * activated, cancelled, expired, declined, frozen, etc. We use it to keep
 * shop.plan in DB in sync with what Shopify thinks the merchant is paying for,
 * so non-admin code paths (the scheduler, background jobs, the
 * checkExportLimits enforcement loop) read accurate plan info.
 *
 * The Shopify billing.check() helper inside admin contexts is still the live
 * source of truth — shop.plan is just a cache for non-admin reads.
 */
export const action = async ({ request }) => {
  const { shop, payload } = await authenticate.webhook(request);

  const subscription = payload?.app_subscription;
  if (!subscription) {
    // Shopify occasionally sends test pings without a body — accept silently.
    return new Response();
  }

  const status = subscription.status;
  const subscriptionName = subscription.name;

  // Only ACTIVE means the merchant is currently entitled to the named plan.
  // Anything else (CANCELLED, DECLINED, EXPIRED, FROZEN, PENDING) drops them
  // back to free. FROZEN in particular means a billing failure — they should
  // not retain paid entitlements while their card is rejected.
  const tier = status === "ACTIVE" ? planTierFromName(subscriptionName) : "free";

  // Upsert so the webhook is safe even if it fires before the merchant has
  // hit any admin route — e.g. during a re-install where shop.plan was reset.
  await db.shop.upsert({
    where: { shopDomain: shop },
    create: {
      shopDomain: shop,
      plan: tier,
    },
    update: {
      plan: tier,
    },
  });

  return new Response();
};
