import { useCallback } from "react";
import { useLoaderData, useRouteError } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  Button,
  Badge,
  Box,
  Divider,
  Banner,
  Icon,
} from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { PLANS } from "../plans-config";
import { ensureShop } from "../utils/shop.server";
import { syncShopPlan } from "../services/billing.server";

/**
 * Plans page — Shopify-hosted subscription confirmation flow.
 *
 * Flow:
 *  1. Loader reads the merchant's live billing state from Shopify (source of
 *     truth) and persists the resolved tier to shop.plan as a side effect.
 *  2. The merchant picks a plan + cycle and submits the form.
 *  3. Action calls billing.request(...), which returns a redirect to Shopify's
 *     hosted confirmation page. Shopify charges the merchant after approval
 *     and fires app_subscriptions/update, which our webhook handler uses to
 *     refresh shop.plan.
 *  4. After approval, Shopify sends the merchant back to returnUrl (the app
 *     root), where they see the new entitlements live.
 */

const FEATURE_LISTS = {
  free: [
    "Connect any subscription app",
    "5 exports per month",
    "CSV export",
    "Up to 250 rows per export",
    "Search, sort & filter",
    "Export history",
    "Basic dashboard",
  ],
  growth: [
    "50 exports per month",
    "Up to 5,000 rows per export",
    "CSV, Excel & Google Sheets",
    "Scheduled exports (email)",
    "Save up to 10 templates",
    "At-risk subscriber alerts",
    "Cohort retention analytics",
    "Full subscriber dashboard",
  ],
  pro: [
    "Unlimited exports",
    "Unlimited rows per export",
    "CSV, Excel & Google Sheets",
    "Email + Slack scheduled exports",
    "Unlimited saved templates",
    "At-risk subscriber alerts",
    "Cohort retention analytics",
    "Priority email support",
  ],
};

export const loader = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  // Resolve from Shopify (source of truth) and persist back to shop.plan so
  // the non-admin scheduler sees the same value.
  const resolved = await syncShopPlan(billing, shop.id);

  // Build the Shopify-hosted Managed Pricing URL.
  //
  // SubsExport is enrolled in Shopify's Managed Pricing programme — Shopify
  // hosts the subscription confirmation UI at:
  //   https://admin.shopify.com/store/{shop-handle}/charges/{app-handle}/pricing_plans
  //
  // Managed Pricing apps CANNOT call the Billing API's appSubscriptionCreate
  // mutation (billing.request() throws "Managed Pricing Apps cannot use the
  // Billing API"). Instead we redirect the merchant to the hosted page; they
  // pick a plan there; Shopify charges them; the app_subscriptions/update
  // webhook fires; our handler persists the new shop.plan; the merchant
  // returns to the app already on the new tier.
  //
  // app-handle is the URL slug from the Partner Dashboard ("subsexport").
  // We read it from an env var so a future renamed app doesn't require code
  // changes — only an env var update.
  const shopHandle = session.shop.replace(".myshopify.com", "");
  const appHandle = process.env.SHOPIFY_APP_HANDLE || "subsexport";
  const managedPricingUrl = `https://admin.shopify.com/store/${shopHandle}/charges/${appHandle}/pricing_plans`;

  return {
    currentTier: resolved.tier,
    currentSubscriptionName: resolved.subscriptionName,
    managedPricingUrl,
  };
};

// No action handler — Managed Pricing apps do all subscribe/upgrade/downgrade
// flows through Shopify's hosted pricing page (see loader comment). The
// "Upgrade" buttons trigger a client-side top-frame redirect instead of a
// form submission.

export default function PlansPage() {
  const { currentTier, currentSubscriptionName, managedPricingUrl } =
    useLoaderData();

  // Monthly is the only billing cycle exposed in the UI right now. Annual
  // plans remain configured in shopify.server.js for when we re-introduce a
  // per-card "Switch to annual" button.
  const cycle = "monthly";

  // No form submission and no fetcher state — Managed Pricing apps redirect
  // the merchant out to admin.shopify.com so Shopify can host the actual
  // subscription UI. The page never reaches a "submitting" state here.
  const isSubmitting = false;

  const handleSubscribe = useCallback(() => {
    // Top-frame redirect: SubsExport is embedded inside the Shopify admin
    // iframe, so `window.open(url, '_top')` tells the browser to navigate
    // the parent (admin) frame instead of opening a new tab or trying to
    // load admin.shopify.com inside our own iframe (which Shopify blocks
    // with X-Frame-Options).
    if (typeof window !== "undefined") {
      window.open(managedPricingUrl, "_top");
    }
  }, [managedPricingUrl]);

  return (
    <Page title="Plans" subtitle="Choose the plan that fits your subscription ops">
      <Layout>
        <Layout.Section>
          <Banner tone="info" title="Subscription managed by Shopify">
            <p>
              Picking a plan opens Shopify's hosted billing page in this same
              window. Charges and cancellations are handled by Shopify and
              appear on your Shopify invoice.
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          {/*
            InlineGrid gives equal-width AND equal-height cells out of the box
            (each cell stretches to the tallest), which keeps the three cards
            visually aligned regardless of how many lines of price/feature
            copy live inside any one of them. Falls back to a single column
            below ~640px so the page is usable on small screens.
          */}
          <InlineGrid
            gap="400"
            columns={{ xs: 1, sm: 1, md: 3, lg: 3, xl: 3 }}
          >
            <PlanCard
              tier="free"
              title="Free"
              priceLabel="Free"
              secondaryLabel={null}
              features={FEATURE_LISTS.free}
              currentTier={currentTier}
              currentSubscriptionName={currentSubscriptionName}
              cycle={cycle}
              planName={null}
              onSubscribe={handleSubscribe}
              isSubmitting={isSubmitting}
            />
            <PlanCard
              tier="growth"
              title="Growth"
              priceLabel={cycle === "monthly" ? "$19" : "$17.10"}
              priceUnit={cycle === "monthly" ? "/ month" : "/ month, billed annually"}
              secondaryLabel={
                cycle === "monthly"
                  ? "or $205.20/year and save 10%"
                  : "$205.20 billed annually"
              }
              features={FEATURE_LISTS.growth}
              currentTier={currentTier}
              currentSubscriptionName={currentSubscriptionName}
              cycle={cycle}
              planName={cycle === "monthly" ? PLANS.GROWTH_MONTHLY : PLANS.GROWTH_ANNUAL}
              onSubscribe={handleSubscribe}
              isSubmitting={isSubmitting}
              highlight
            />
            <PlanCard
              tier="pro"
              title="Pro"
              priceLabel={cycle === "monthly" ? "$49" : "$44.10"}
              priceUnit={cycle === "monthly" ? "/ month" : "/ month, billed annually"}
              secondaryLabel={
                cycle === "monthly"
                  ? "or $529.20/year and save 10%"
                  : "$529.20 billed annually"
              }
              features={FEATURE_LISTS.pro}
              currentTier={currentTier}
              currentSubscriptionName={currentSubscriptionName}
              cycle={cycle}
              planName={cycle === "monthly" ? PLANS.PRO_MONTHLY : PLANS.PRO_ANNUAL}
              onSubscribe={handleSubscribe}
              isSubmitting={isSubmitting}
            />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Billing handled by Shopify
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Subscriptions are charged on your Shopify invoice. Cancel or
                change plans any time — Shopify prorates the unused portion of
                your current cycle automatically.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Tail spacer so the last card never sits flush against the bottom of
            the embedded app frame — gives a comfortable scroll-end margin. */}
        <Layout.Section>
          <Box paddingBlockEnd="800" />
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function PlanCard({
  tier,
  title,
  priceLabel,
  priceUnit,
  secondaryLabel,
  features,
  currentTier,
  currentSubscriptionName,
  cycle,
  planName,
  onSubscribe,
  isSubmitting,
  highlight,
}) {
  const isFree = tier === "free";

  // One card per tier under the current single-cycle layout — comparing
  // currentTier to tier is sufficient to decide which card carries the
  // "Current" badge. The previous logic also required currentSubscriptionName
  // to match the card's planName exactly, but Shopify's billing.check() can
  // legitimately return `null` for subscriptionName when (a) the cached
  // shop.plan was set via webhook ahead of a billing.check round-trip, or
  // (b) a developer manually promoted the cached plan for testing.
  const isExactCurrentPlan = currentTier === tier;

  let ctaLabel;
  if (isExactCurrentPlan) {
    ctaLabel = "Current plan";
  } else if (isFree) {
    ctaLabel = "Free forever";
  } else if (rank(tier) > rank(currentTier)) {
    ctaLabel = `Upgrade to ${title}`;
  } else if (rank(tier) < rank(currentTier)) {
    ctaLabel = `Downgrade to ${title}`;
  } else {
    ctaLabel = `Switch to ${cycle}`;
  }

  return (
    // height="100%" + the BlockStack below makes the card stretch to fill the
    // InlineGrid cell, so all three cards share the tallest one's height
    // regardless of feature-count differences between tiers.
    <Box minWidth="280px" minHeight="100%">
      <Card>
        <BlockStack gap="400">
          <BlockStack gap="100">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h3" variant="headingMd">
                {title}
              </Text>
              {highlight && !isExactCurrentPlan && (
                <Badge tone="success">Most popular</Badge>
              )}
              {isExactCurrentPlan && <Badge tone="info">Current</Badge>}
            </InlineStack>
            <InlineStack gap="100" blockAlign="baseline">
              <Text as="p" variant="heading2xl">
                {priceLabel}
              </Text>
              {priceUnit && (
                <Text as="p" variant="bodyMd" tone="subdued">
                  {priceUnit}
                </Text>
              )}
            </InlineStack>
            {/* Reserve the same vertical space on the Free card (which has no
                annual-billing subline) so the divider lines up across all
                three cards. */}
            {secondaryLabel ? (
              <Text as="p" variant="bodySm" tone="success">
                {secondaryLabel}
              </Text>
            ) : (
              <Box minHeight="20px" />
            )}
          </BlockStack>

          <Divider />

          <BlockStack gap="200">
            <Text as="p" variant="headingSm">
              Features
            </Text>
            <BlockStack gap="150">
              {features.map((feature) => (
                // align="start" pins the icon + text to the left edge so the
                // feature list reads top-down on the left like a proper bullet
                // list (without this the implicit space-between right-aligns
                // the text and leaves a gap after the icon).
                <InlineStack
                  key={feature}
                  gap="200"
                  blockAlign="start"
                  align="start"
                  wrap={false}
                >
                  {/* Polaris React <Icon> renders the imported SVG — the App
                      Bridge <s-icon> web component used previously expects a
                      string `source` identifier, not a React component, so it
                      silently rendered nothing. */}
                  <Box>
                    <Icon source={CheckIcon} tone="success" />
                  </Box>
                  <Text as="p" variant="bodySm">
                    {feature}
                  </Text>
                </InlineStack>
              ))}
            </BlockStack>
          </BlockStack>

          {!isFree && (
            <Button
              variant={highlight && !isExactCurrentPlan ? "primary" : "secondary"}
              size="large"
              fullWidth
              disabled={isExactCurrentPlan || isSubmitting}
              loading={isSubmitting}
              onClick={() => planName && onSubscribe(planName)}
            >
              {ctaLabel}
            </Button>
          )}
          {isFree && (
            <Box>
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                {ctaLabel}
              </Text>
            </Box>
          )}
        </BlockStack>
      </Card>
    </Box>
  );
}

function rank(tier) {
  return { free: 0, growth: 1, pro: 2 }[tier] ?? 0;
}

export function ErrorBoundary() {
  // Reuse the embedded boundary helper so billing errors render inside the
  // App Bridge shell instead of bubbling up as a raw error page.
  return boundary.error(useRouteError());
}
