import { useState, useCallback } from "react";
import { useLoaderData, useFetcher } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Button,
  BlockStack,
  InlineStack,
  TextField,
  Banner,
} from "@shopify/polaris";
import { LinkIcon, DeleteIcon } from "@shopify/polaris-icons";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop, getShopWithConnections } from "../utils/shop.server";
import { encrypt } from "../utils/encryption.server";
import { SUBSCRIPTION_APPS } from "../utils/subscription-apps";
import { verifyRechargeApiKey } from "../services/recharge.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopWithConnections(session.shop);

  const connections = {};
  if (shop?.connections) {
    for (const conn of shop.connections) {
      connections[conn.appName] = {
        status: conn.status,
        lastVerifiedAt: conn.lastVerifiedAt,
      };
    }
  }

  return { connections };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const appSlug = formData.get("appSlug");

  if (!SUBSCRIPTION_APPS[appSlug]) {
    return { error: "Invalid subscription app." };
  }

  const shop = await ensureShop(session.shop);

  if (intent === "connect") {
    const appConfig = SUBSCRIPTION_APPS[appSlug];

    if (appConfig.phase === "B") {
      return { error: `${appConfig.name} integration is coming soon.` };
    }

    if (appConfig.authType === "api_key") {
      const apiKey = formData.get("apiKey");
      if (!apiKey || apiKey.trim().length === 0) {
        return { error: "API key is required." };
      }

      if (appSlug === "recharge") {
        const verification = await verifyRechargeApiKey(apiKey.trim());
        if (!verification.valid) {
          return {
            error: `Invalid ReCharge API key: ${verification.error}`,
          };
        }
      }

      await db.appConnection.upsert({
        where: {
          shopId_appName: { shopId: shop.id, appName: appSlug },
        },
        update: {
          apiKeyEnc: encrypt(apiKey.trim()),
          status: "connected",
          lastVerifiedAt: new Date(),
        },
        create: {
          shopId: shop.id,
          appName: appSlug,
          apiKeyEnc: encrypt(apiKey.trim()),
          status: "connected",
          lastVerifiedAt: new Date(),
        },
      });

      return { success: `${appConfig.name} connected successfully.` };
    }

    if (appConfig.authType === "oauth") {
      return { error: `${appConfig.name} OAuth flow is not yet implemented.` };
    }
  }

  if (intent === "disconnect") {
    await db.appConnection.deleteMany({
      where: { shopId: shop.id, appName: appSlug },
    });

    return {
      success: `${SUBSCRIPTION_APPS[appSlug].name} disconnected.`,
    };
  }

  return { error: "Unknown action." };
};

function ConnectionCard({ appConfig, connection, onConnect, onDisconnect }) {
  const [apiKey, setApiKey] = useState("");
  const [showForm, setShowForm] = useState(false);
  const isConnected = connection?.status === "connected";
  const isPhaseB = appConfig.phase === "B";

  const handleConnect = useCallback(() => {
    if (appConfig.authType === "api_key") {
      onConnect(appConfig.slug, apiKey);
      setApiKey("");
      setShowForm(false);
    } else {
      onConnect(appConfig.slug);
    }
  }, [appConfig, apiKey, onConnect]);

  const statusBadge = () => {
    if (isPhaseB) return <Badge tone="info">Coming Soon</Badge>;
    if (!connection) return <Badge>Not Connected</Badge>;
    if (isConnected) return <Badge tone="success">Connected</Badge>;
    if (connection.status === "error")
      return <Badge tone="critical">Error</Badge>;
    return <Badge>Disconnected</Badge>;
  };

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Text as="h2" variant="headingMd">
              {appConfig.name}
            </Text>
            {statusBadge()}
          </InlineStack>
          <Text as="span" variant="bodySm" tone="subdued">
            {appConfig.rateLimit}
          </Text>
        </InlineStack>

        <Text as="p" variant="bodyMd" tone="subdued">
          {appConfig.description}
        </Text>

        {isConnected && connection.lastVerifiedAt && (
          <Text as="p" variant="bodySm" tone="subdued">
            Last verified:{" "}
            {new Date(connection.lastVerifiedAt).toLocaleDateString()}
          </Text>
        )}

        {!isPhaseB && !isConnected && appConfig.authType === "api_key" && (
          <>
            {showForm ? (
              <BlockStack gap="200">
                <TextField
                  label="API Key"
                  value={apiKey}
                  onChange={setApiKey}
                  autoComplete="off"
                  type="password"
                  placeholder={`Enter your ${appConfig.name} API key`}
                />
                <InlineStack gap="200">
                  <Button variant="primary" onClick={handleConnect}>
                    Connect
                  </Button>
                  <Button onClick={() => setShowForm(false)}>Cancel</Button>
                </InlineStack>
              </BlockStack>
            ) : (
              <InlineStack>
                <Button
                  icon={LinkIcon}
                  onClick={() => setShowForm(true)}
                >
                  Connect {appConfig.name}
                </Button>
              </InlineStack>
            )}
          </>
        )}

        {!isPhaseB && !isConnected && appConfig.authType === "oauth" && (
          <InlineStack>
            <Button
              icon={LinkIcon}
              onClick={() => onConnect(appConfig.slug)}
            >
              Connect {appConfig.name}
            </Button>
          </InlineStack>
        )}

        {isConnected && (
          <InlineStack>
            <Button
              icon={DeleteIcon}
              tone="critical"
              variant="plain"
              onClick={() => onDisconnect(appConfig.slug)}
            >
              Disconnect
            </Button>
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}

export default function ConnectionsPage() {
  const { connections } = useLoaderData();
  const fetcher = useFetcher();

  const isSubmitting = fetcher.state !== "idle";
  const result = fetcher.data;

  const handleConnect = useCallback(
    (appSlug, apiKey) => {
      const formData = new FormData();
      formData.set("intent", "connect");
      formData.set("appSlug", appSlug);
      if (apiKey) formData.set("apiKey", apiKey);
      fetcher.submit(formData, { method: "POST" });
    },
    [fetcher],
  );

  const handleDisconnect = useCallback(
    (appSlug) => {
      const formData = new FormData();
      formData.set("intent", "disconnect");
      formData.set("appSlug", appSlug);
      fetcher.submit(formData, { method: "POST" });
    },
    [fetcher],
  );

  const phaseAApps = Object.values(SUBSCRIPTION_APPS).filter(
    (app) => app.phase === "A",
  );
  const phaseBApps = Object.values(SUBSCRIPTION_APPS).filter(
    (app) => app.phase === "B",
  );

  return (
    <Page
      title="Connections"
      subtitle="Connect your subscription apps to start exporting data"
    >
      <BlockStack gap="400">
        {result?.error && (
          <Banner tone="critical" onDismiss={() => {}}>
            <p>{result.error}</p>
          </Banner>
        )}
        {result?.success && (
          <Banner tone="success" onDismiss={() => {}}>
            <p>{result.success}</p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                Supported Apps
              </Text>
              {phaseAApps.map((app) => (
                <ConnectionCard
                  key={app.slug}
                  appConfig={app}
                  connection={connections[app.slug]}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
              ))}
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                Coming Soon
              </Text>
              {phaseBApps.map((app) => (
                <ConnectionCard
                  key={app.slug}
                  appConfig={app}
                  connection={connections[app.slug]}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
              ))}
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
