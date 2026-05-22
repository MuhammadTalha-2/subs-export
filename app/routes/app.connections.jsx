import { useState, useCallback, useEffect } from "react";
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
  InlineGrid,
  TextField,
  Select,
  Divider,
  Box,
  Icon,
} from "@shopify/polaris";
import {
  LinkIcon,
  DeleteIcon,
  CheckCircleIcon,
} from "@shopify/polaris-icons";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop, getShopWithConnections } from "../utils/shop.server";
import { encrypt } from "../utils/encryption.server";
import { SUBSCRIPTION_APPS } from "../utils/subscription-apps";
import { verifyRechargeApiKey } from "../services/recharge.server";
import { verifySealApiKey } from "../services/seal.server";
import { verifySkioApiKey } from "../services/skio.server";
import { verifyLoopApiKey } from "../services/loop.server";
import { verifyPayWhirlCredentials } from "../services/paywhirl.server";

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

    if (appConfig.authType === "none") {
      await db.appConnection.upsert({
        where: {
          shopId_appName: { shopId: shop.id, appName: appSlug },
        },
        update: {
          status: "connected",
          lastVerifiedAt: new Date(),
        },
        create: {
          shopId: shop.id,
          appName: appSlug,
          status: "connected",
          lastVerifiedAt: new Date(),
        },
      });

      return { success: `${appConfig.name} connected successfully.` };
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

      if (appSlug === "seal") {
        const verification = await verifySealApiKey(apiKey.trim());
        if (!verification.valid) {
          return {
            error: `Invalid Seal API token: ${verification.error}`,
          };
        }
      }

      if (appSlug === "skio") {
        const verification = await verifySkioApiKey(apiKey.trim());
        if (!verification.valid) {
          return {
            error: `Invalid Skio API key: ${verification.error}`,
          };
        }
      }

      if (appSlug === "loop") {
        const verification = await verifyLoopApiKey(apiKey.trim());
        if (!verification.valid) {
          return {
            error: `Invalid Loop API token: ${verification.error}`,
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

    if (appConfig.authType === "paywhirl") {
      const apiKey = formData.get("apiKey");
      const apiSecret = formData.get("apiSecret");
      const variant = formData.get("variant") || "classic";

      if (!apiKey || !apiSecret) {
        return { error: "Both API Key and API Secret are required." };
      }

      const creds = {
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        variant,
      };

      const verification = await verifyPayWhirlCredentials(creds);
      if (!verification.valid) {
        return { error: verification.error };
      }

      const stored = JSON.stringify(creds);

      await db.appConnection.upsert({
        where: {
          shopId_appName: { shopId: shop.id, appName: appSlug },
        },
        update: {
          apiKeyEnc: encrypt(stored),
          status: "connected",
          lastVerifiedAt: new Date(),
        },
        create: {
          shopId: shop.id,
          appName: appSlug,
          apiKeyEnc: encrypt(stored),
          status: "connected",
          lastVerifiedAt: new Date(),
        },
      });

      return { success: `${appConfig.name} connected successfully.` };
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

function AppLogo({ src, name }) {
  return (
    <img
      src={src}
      alt={name}
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        flexShrink: 0,
      }}
    />
  );
}

function ConnectedAppCard({ appConfig, connection, onDisconnect, loading }) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <AppLogo src={appConfig.logo} name={appConfig.name} />
          <BlockStack gap="050">
            <InlineStack gap="200" blockAlign="center">
              <Text as="h3" variant="headingMd">
                {appConfig.name}
              </Text>
              <Badge tone="success">Connected</Badge>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
              {appConfig.description}
            </Text>
          </BlockStack>
        </InlineStack>

        <Divider />

        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="300">
            <InlineStack gap="100" blockAlign="center">
              <Icon source={CheckCircleIcon} tone="success" />
              <Text as="span" variant="bodySm" tone="success">
                Verified {connection.lastVerifiedAt
                  ? new Date(connection.lastVerifiedAt).toLocaleDateString()
                  : ""}
              </Text>
            </InlineStack>
            <Text as="span" variant="bodySm" tone="subdued">
              {appConfig.rateLimit}
            </Text>
          </InlineStack>

          <Button
            icon={DeleteIcon}
            tone="critical"
            variant="plain"
            onClick={() => onDisconnect(appConfig.slug)}
            loading={loading}
          >
            Disconnect
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

function AvailableAppCard({ appConfig, onConnect, loading }) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [variant, setVariant] = useState("classic");
  const [showForm, setShowForm] = useState(false);

  const handleConnect = useCallback(() => {
    if (appConfig.authType === "paywhirl") {
      onConnect(appConfig.slug, { apiKey, apiSecret, variant });
      setApiKey("");
      setApiSecret("");
      setShowForm(false);
    } else if (appConfig.authType === "api_key") {
      onConnect(appConfig.slug, apiKey);
      setApiKey("");
      setShowForm(false);
    } else {
      onConnect(appConfig.slug);
    }
  }, [appConfig, apiKey, apiSecret, variant, onConnect]);

  const authLabel =
    appConfig.authType === "api_key" ? "API Key" :
    appConfig.authType === "paywhirl" ? "API Key + Secret" :
    appConfig.authType === "oauth" ? "OAuth" : "Instant";

  const requiresForm =
    appConfig.authType === "api_key" || appConfig.authType === "paywhirl";

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <AppLogo src={appConfig.logo} name={appConfig.name} />
          <BlockStack gap="050">
            <Text as="h3" variant="headingMd">
              {appConfig.name}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {appConfig.description}
            </Text>
          </BlockStack>
        </InlineStack>

        <Divider />

        {showForm ? (
          <BlockStack gap="300">
            {appConfig.authType === "paywhirl" && (
              <Select
                label="Account type"
                options={[
                  { label: "PayWhirl Classic (api.paywhirl.com)", value: "classic" },
                  { label: "PayWhirl Shopify (api.shop.paywhirl.com)", value: "shopify" },
                ]}
                value={variant}
                onChange={setVariant}
                helpText="Pick the variant that matches where you installed PayWhirl"
              />
            )}
            <TextField
              label="API Key"
              value={apiKey}
              onChange={setApiKey}
              autoComplete="off"
              type="password"
              placeholder={`Enter your ${appConfig.name} API key`}
            />
            {appConfig.authType === "paywhirl" && (
              <TextField
                label="API Secret"
                value={apiSecret}
                onChange={setApiSecret}
                autoComplete="off"
                type="password"
                placeholder="Enter your PayWhirl API secret"
              />
            )}
            <InlineStack gap="200" blockAlign="center">
              <Button variant="primary" onClick={handleConnect} loading={loading}>
                Verify & Connect
              </Button>
              <Button onClick={() => setShowForm(false)}>Cancel</Button>
            </InlineStack>
            {appConfig.docsUrl && (
              <Text as="p" variant="bodySm" tone="subdued">
                Find your {appConfig.authType === "paywhirl" ? "API keys" : "API key"} in your{" "}
                <Button variant="plain" url={appConfig.docsUrl} external>
                  {appConfig.name} dashboard
                </Button>
              </Text>
            )}
          </BlockStack>
        ) : (
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="200">
              <Badge>{authLabel}</Badge>
              <Text as="span" variant="bodySm" tone="subdued">
                {appConfig.rateLimit}
              </Text>
            </InlineStack>
            <Button
              icon={LinkIcon}
              variant={appConfig.authType === "none" ? "primary" : undefined}
              onClick={async () => {
                if (requiresForm) {
                  setShowForm(true);
                } else if (appConfig.authType === "oauth" && appConfig.slug === "bold") {
                  try {
                    const res = await fetch("/auth/bold");
                    const data = await res.json();
                    if (data.authUrl) {
                      window.open(data.authUrl, "_blank");
                    } else if (data.error) {
                      shopify.toast.show(data.error, { isError: true });
                    }
                  } catch (err) {
                    shopify.toast.show(
                      "Failed to start Bold OAuth: " + err.message,
                      { isError: true },
                    );
                  }
                } else {
                  onConnect(appConfig.slug);
                }
              }}
              loading={loading}
            >
              Connect
            </Button>
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}

function ComingSoonCard({ appConfig }) {
  const authLabel =
    appConfig.authType === "api_key" ? "API Key" :
    appConfig.authType === "oauth" ? "OAuth" : "Instant";

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <AppLogo src={appConfig.logo} name={appConfig.name} />
          <BlockStack gap="050">
            <Text as="h3" variant="headingSm">
              {appConfig.name}
            </Text>
            <InlineStack gap="200" blockAlign="center">
              <Badge tone="info">Coming Soon</Badge>
              <Text as="span" variant="bodySm" tone="subdued">
                {authLabel}
              </Text>
            </InlineStack>
          </BlockStack>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

export default function ConnectionsPage() {
  const { connections } = useLoaderData();
  const fetcher = useFetcher();

  const result = fetcher.data;
  const [activeSlug, setActiveSlug] = useState(null);
  const isSubmitting = fetcher.state !== "idle";

  useEffect(() => {
    if (!isSubmitting) setActiveSlug(null);
  }, [isSubmitting]);

  useEffect(() => {
    if (result?.success) {
      shopify.toast.show(result.success);
    } else if (result?.error) {
      shopify.toast.show(result.error, { isError: true });
    }
  }, [result]);

  const handleConnect = useCallback(
    (appSlug, apiKey) => {
      setActiveSlug(appSlug);
      const formData = new FormData();
      formData.set("intent", "connect");
      formData.set("appSlug", appSlug);
      if (apiKey && typeof apiKey === "object") {
        if (apiKey.apiKey) formData.set("apiKey", apiKey.apiKey);
        if (apiKey.apiSecret) formData.set("apiSecret", apiKey.apiSecret);
        if (apiKey.variant) formData.set("variant", apiKey.variant);
      } else if (apiKey) {
        formData.set("apiKey", apiKey);
      }
      fetcher.submit(formData, { method: "POST" });
    },
    [fetcher],
  );

  const handleDisconnect = useCallback(
    (appSlug) => {
      setActiveSlug(appSlug);
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

  const connectedApps = phaseAApps.filter(
    (app) => connections[app.slug]?.status === "connected",
  );
  const availableApps = phaseAApps.filter(
    (app) => connections[app.slug]?.status !== "connected",
  );

  return (
    <Page>
      <ui-title-bar title="Connections" />
      <BlockStack gap="500">
        {connectedApps.length > 0 && (
          <Layout>
            <Layout.Section>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Active Connections
                  </Text>
                  <Badge tone="success">
                    {connectedApps.length} {connectedApps.length === 1 ? "app" : "apps"}
                  </Badge>
                </InlineStack>
                {connectedApps.map((app) => (
                  <ConnectedAppCard
                    key={app.slug}
                    appConfig={app}
                    connection={connections[app.slug]}
                    onDisconnect={handleDisconnect}
                    loading={isSubmitting && activeSlug === app.slug}
                  />
                ))}
              </BlockStack>
            </Layout.Section>
          </Layout>
        )}

        {availableApps.length > 0 && (
          <Layout>
            <Layout.Section>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Available to Connect
                  </Text>
                  <Badge>
                    {availableApps.length} {availableApps.length === 1 ? "app" : "apps"}
                  </Badge>
                </InlineStack>
                {availableApps.map((app) => (
                  <AvailableAppCard
                    key={app.slug}
                    appConfig={app}
                    onConnect={handleConnect}
                    loading={isSubmitting && activeSlug === app.slug}
                  />
                ))}
              </BlockStack>
            </Layout.Section>
          </Layout>
        )}

        <Layout>
          <Layout.Section>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Coming Soon
              </Text>
              <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                {phaseBApps.map((app) => (
                  <ComingSoonCard key={app.slug} appConfig={app} />
                ))}
              </InlineGrid>
            </BlockStack>
          </Layout.Section>
        </Layout>

        <Box paddingBlockEnd="400" />
      </BlockStack>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
