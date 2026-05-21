import { useLoaderData } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Badge,
} from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../utils/shop.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  return { plan: shop.plan };
};

export default function SettingsPage() {
  const { plan } = useLoaderData();

  return (
    <Page title="Settings">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Billing Plan
              </Text>
              <Text as="p" variant="bodyMd">
                Current plan:{" "}
                <Badge tone={plan === "free" ? undefined : "success"}>
                  {plan.charAt(0).toUpperCase() + plan.slice(1)}
                </Badge>
              </Text>
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
