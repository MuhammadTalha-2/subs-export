import { Page, Layout, Card, Text, EmptyState } from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function ExportsPage() {
  return (
    <Page title="Exports" subtitle="Export and download your subscription data">
      <Layout>
        <Layout.Section>
          <Card>
            <EmptyState
              heading="No exports yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Connect a subscription app and create your first export from the
                Connections page.
              </p>
            </EmptyState>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
