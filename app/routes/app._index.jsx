import { useLoaderData } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Divider,
  InlineGrid,
} from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopWithConnections } from "../utils/shop.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopWithConnections(session.shop);

  const connectedApps = shop?.connections?.filter(
    (c) => c.status === "connected",
  ) || [];

  return {
    plan: shop?.plan || "free",
    monthlyExportCount: shop?.monthlyExportCount || 0,
    connectedApps: connectedApps.length,
    connectedAppNames: connectedApps.map((c) => c.appName),
  };
};

export default function Index() {
  const { plan, monthlyExportCount, connectedApps, connectedAppNames } =
    useLoaderData();

  const planLimits = {
    free: 5,
    starter: 30,
    growth: 100,
    pro: Infinity,
  };
  const exportLimit = planLimits[plan] || 5;

  return (
    <Page title="SubsExport" subtitle="Subscription data exporter for Shopify">
      <Layout>
        <Layout.Section>
          <InlineGrid columns={3} gap="400">
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  Connected Apps
                </Text>
                <Text as="p" variant="headingXl">
                  {connectedApps}
                </Text>
                {connectedAppNames.length > 0 ? (
                  <InlineStack gap="100">
                    {connectedAppNames.map((name) => (
                      <Badge key={name} tone="success">
                        {name}
                      </Badge>
                    ))}
                  </InlineStack>
                ) : (
                  <Text as="p" variant="bodySm" tone="subdued">
                    No apps connected yet
                  </Text>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  Exports This Month
                </Text>
                <Text as="p" variant="headingXl">
                  {monthlyExportCount}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {exportLimit === Infinity
                    ? "Unlimited"
                    : `${exportLimit - monthlyExportCount} remaining`}
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  Current Plan
                </Text>
                <Text as="p" variant="headingXl" textTransform="capitalize">
                  {plan}
                </Text>
                {plan === "free" && (
                  <Button url="/app/settings" variant="plain">
                    Upgrade plan
                  </Button>
                )}
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Getting Started
              </Text>
              <Divider />
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone={connectedApps > 0 ? "success" : undefined}>
                    1
                  </Badge>
                  <Text as="p" variant="bodyMd">
                    Connect your subscription app (ReCharge, Bold, etc.)
                  </Text>
                  {connectedApps === 0 && (
                    <Button url="/app/connections" size="slim">
                      Connect now
                    </Button>
                  )}
                </InlineStack>
                <InlineStack gap="200" blockAlign="center">
                  <Badge>2</Badge>
                  <Text as="p" variant="bodyMd">
                    Preview and filter your subscription data
                  </Text>
                </InlineStack>
                <InlineStack gap="200" blockAlign="center">
                  <Badge>3</Badge>
                  <Text as="p" variant="bodyMd">
                    Export as CSV, Excel, or Google Sheets
                  </Text>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
