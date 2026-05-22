import { useState, useCallback } from "react";
import { useLoaderData, useNavigate } from "react-router";
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
  Box,
  Icon,
  ProgressBar,
  DataTable,
  Collapsible,
  ButtonGroup,
} from "@shopify/polaris";
import {
  LinkIcon,
  ExportIcon,
  ClockIcon,
  PersonIcon,
  ViewIcon,
  SettingsIcon,
  CheckCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XSmallIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  PauseCircleIcon,
  ArrowRightIcon,
} from "@shopify/polaris-icons";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopWithConnections } from "../utils/shop.server";
import db from "../db.server";
import { decrypt } from "../utils/encryption.server";
import {
  fetchRechargeSubscriptions,
  mapRechargeToUnified,
} from "../services/recharge.server";
import {
  fetchSealSubscriptions,
  mapSealToUnified,
} from "../services/seal.server";
import {
  fetchSkioSubscriptions,
  mapSkioToUnified,
} from "../services/skio.server";
import {
  fetchLoopSubscriptions,
  mapLoopToUnified,
} from "../services/loop.server";
import {
  fetchPayWhirlSubscriptions,
  mapPayWhirlToUnified,
} from "../services/paywhirl.server";
import {
  fetchBoldSubscriptions,
  mapBoldToUnified,
} from "../services/bold.server";
import { generateDemoData } from "../services/demo-data.server";
import { getGoogleAuthStatus } from "../services/google-auth.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopWithConnections(session.shop);

  const connectedApps =
    shop?.connections?.filter((c) => c.status === "connected") || [];

  const recentExports = await db.exportJob.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const scheduledCount = await db.scheduledExport.count({
    where: { shopId: shop.id, isActive: true },
  });

  const googleAuth = await getGoogleAuthStatus(shop.id);

  let subscriptionStats = null;
  if (connectedApps.length > 0) {
    try {
      let allRows = [];
      for (const conn of connectedApps) {
        if (conn.appName === "demo") {
          allRows.push(...generateDemoData(150));
        } else if (conn.appName === "recharge") {
          const apiKey = decrypt(conn.apiKeyEnc);
          const rawSubs = await fetchRechargeSubscriptions(apiKey, {
            limit: 250,
          });
          allRows.push(...rawSubs.map(mapRechargeToUnified));
        } else if (conn.appName === "seal") {
          const apiKey = decrypt(conn.apiKeyEnc);
          const rawSubs = await fetchSealSubscriptions(apiKey, {
            limit: 250,
          });
          allRows.push(...rawSubs.map(mapSealToUnified));
        } else if (conn.appName === "skio") {
          const apiKey = decrypt(conn.apiKeyEnc);
          const rawSubs = await fetchSkioSubscriptions(apiKey, {
            limit: 250,
          });
          allRows.push(...rawSubs.map(mapSkioToUnified));
        } else if (conn.appName === "loop") {
          const apiKey = decrypt(conn.apiKeyEnc);
          const rawSubs = await fetchLoopSubscriptions(apiKey, {
            limit: 250,
          });
          allRows.push(...rawSubs.map(mapLoopToUnified));
        } else if (conn.appName === "paywhirl") {
          const creds = JSON.parse(decrypt(conn.apiKeyEnc));
          const rawSubs = await fetchPayWhirlSubscriptions(creds, {
            limit: 250,
          });
          allRows.push(...rawSubs.map(mapPayWhirlToUnified));
        } else if (conn.appName === "bold") {
          const creds = JSON.parse(decrypt(conn.apiKeyEnc));
          const rawSubs = await fetchBoldSubscriptions(creds, {
            limit: 250,
          });
          allRows.push(...rawSubs.map(mapBoldToUnified));
        }
      }

      const statusCounts = {};
      let totalRevenue = 0;
      let failedCount = 0;
      let overdueCount = 0;
      let recentlyCancelledCount = 0;

      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      for (const row of allRows) {
        const status = row.subscription_status || "unknown";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        if (row.total_revenue_to_date) {
          totalRevenue += parseFloat(row.total_revenue_to_date) || 0;
        }

        if (status === "failed") failedCount += 1;

        if (
          status === "active" &&
          row.next_charge_date &&
          row.next_charge_date < today
        ) {
          overdueCount += 1;
        }

        if (
          row.cancellation_date &&
          row.cancellation_date >= thirtyDaysAgo &&
          row.cancellation_date <= today
        ) {
          recentlyCancelledCount += 1;
        }
      }

      subscriptionStats = {
        total: allRows.length,
        statusCounts,
        totalRevenue: totalRevenue.toFixed(2),
        atRisk: {
          failed: failedCount,
          overdue: overdueCount,
          paused: statusCounts.paused || 0,
          recentlyCancelled: recentlyCancelledCount,
          today,
          thirtyDaysAgo,
        },
      };
    } catch (err) {
      console.error("Dashboard stats error:", err.message);
    }
  }

  return {
    monthlyExportCount: shop?.monthlyExportCount || 0,
    connectedApps: connectedApps.length,
    connectedAppNames: connectedApps.map((c) => c.appName),
    recentExports: recentExports.map((e) => ({
      id: e.id,
      format: e.format,
      status: e.status,
      rowCount: e.rowCount,
      createdAt: e.createdAt,
    })),
    scheduledCount,
    googleConnected: googleAuth.connected,
    subscriptionStats,
  };
};

function AtRiskTile({ label, value, description, icon, tone, onClick }) {
  const toneBg = {
    critical: "bg-surface-critical",
    warning: "bg-surface-warning",
    subdued: "bg-surface-secondary",
  };
  const toneIcon = {
    critical: "critical",
    warning: "warning",
    subdued: "subdued",
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        cursor: "pointer",
        textAlign: "left",
        background: "var(--p-color-bg-surface)",
        border: "1px solid var(--p-color-border-secondary)",
        borderRadius: "var(--p-border-radius-200)",
        padding: "var(--p-space-300)",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--p-color-bg-surface-hover)";
        e.currentTarget.style.borderColor = "var(--p-color-border)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--p-color-bg-surface)";
        e.currentTarget.style.borderColor = "var(--p-color-border-secondary)";
      }}
    >
      <BlockStack gap="200">
        <InlineStack
          align="space-between"
          blockAlign="center"
          wrap={false}
        >
          <Box
            background={toneBg[tone] || "bg-surface-secondary"}
            padding="200"
            borderRadius="200"
          >
            <Icon source={icon} tone={toneIcon[tone] || "subdued"} />
          </Box>
          <Icon source={ArrowRightIcon} tone="subdued" />
        </InlineStack>
        <BlockStack gap="050">
          <Text as="span" variant="bodySm" tone="subdued">
            {label}
          </Text>
          <Text as="span" variant="heading2xl" fontWeight="bold">
            {value.toLocaleString()}
          </Text>
          <Text as="span" variant="bodySm" tone="subdued">
            {description}
          </Text>
        </BlockStack>
      </BlockStack>
    </div>
  );
}

function StatCard({ title, value, icon, children }) {
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="p" variant="bodySm" tone="subdued">
            {title}
          </Text>
          <Box>
            <Icon source={icon} tone="subdued" />
          </Box>
        </InlineStack>
        <Text as="p" variant="headingXl">
          {value}
        </Text>
        {children}
      </BlockStack>
    </Card>
  );
}

function StatusBar({ label, count, total, tone }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <BlockStack gap="100">
      <InlineStack align="space-between">
        <Text as="span" variant="bodySm">
          {label}
        </Text>
        <Text as="span" variant="bodySm" tone="subdued">
          {count}
        </Text>
      </InlineStack>
      <ProgressBar progress={pct} size="small" tone={tone} />
    </BlockStack>
  );
}

export default function Index() {
  const {
    monthlyExportCount,
    connectedApps,
    connectedAppNames,
    recentExports,
    scheduledCount,
    googleConnected,
    subscriptionStats,
  } = useLoaderData();

  const navigate = useNavigate();

  const [setupOpen, setSetupOpen] = useState(true);
  const [setupDismissed, setSetupDismissed] = useState(false);

  const toggleSetup = useCallback(() => setSetupOpen((o) => !o), []);
  const dismissSetup = useCallback(() => setSetupDismissed(true), []);

  const setupSteps = [
    {
      done: connectedApps > 0,
      label: "Connect a subscription app",
      description: "Link ReCharge, Bold, or demo data to start pulling subscriptions.",
      action: connectedApps === 0 ? { content: "Connect app", url: "/app/connections" } : null,
    },
    {
      done: subscriptionStats?.total > 0,
      label: "Preview your subscription data",
      description: "Review and filter your data before exporting.",
      action: connectedApps > 0 && !subscriptionStats?.total ? { content: "Preview data", url: "/app/preview" } : null,
    },
    {
      done: monthlyExportCount > 0,
      label: "Create your first export",
      description: "Export as CSV, Excel, or push to Google Sheets.",
      action: connectedApps > 0 && monthlyExportCount === 0 ? { content: "Create export", url: "/app/exports" } : null,
    },
    {
      done: googleConnected,
      label: "Connect Google Sheets",
      description: "Push exports directly to your Google Drive.",
      action: !googleConnected ? { content: "Connect Google", url: "/app/settings" } : null,
    },
  ];

  const completedSteps = setupSteps.filter((s) => s.done).length;
  const setupProgress = (completedSteps / setupSteps.length) * 100;
  const allComplete = completedSteps === setupSteps.length;

  const formatLabel = (fmt) => {
    if (fmt === "gsheets") return "Sheets";
    return fmt.toUpperCase();
  };

  const statusToneMap = {
    complete: "success",
    processing: "attention",
    queued: "info",
    failed: "critical",
  };

  const recentExportRows = recentExports.map((e) => [
    new Date(e.createdAt).toLocaleDateString(),
    formatLabel(e.format),
    <Badge key={e.id} tone={statusToneMap[e.status]}>
      {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
    </Badge>,
    e.rowCount != null ? e.rowCount.toLocaleString() : "—",
  ]);

  return (
    <Page>
      <ui-title-bar title="Dashboard" />
      <BlockStack gap="400">

        {!setupDismissed && (
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Setup Guide
                  </Text>
                  <Badge tone={allComplete ? "success" : "info"}>
                    {completedSteps} of {setupSteps.length} done
                  </Badge>
                </InlineStack>
                <ButtonGroup>
                  <Button
                    icon={setupOpen ? ChevronUpIcon : ChevronDownIcon}
                    variant="tertiary"
                    onClick={toggleSetup}
                    accessibilityLabel={setupOpen ? "Collapse setup" : "Expand setup"}
                  />
                  <Button
                    icon={XSmallIcon}
                    variant="tertiary"
                    onClick={dismissSetup}
                    accessibilityLabel="Dismiss setup guide"
                  />
                </ButtonGroup>
              </InlineStack>

              <ProgressBar progress={setupProgress} size="small" tone="primary" />

              <Collapsible open={setupOpen} id="setup-collapsible">
                <Box paddingBlockStart="200">
                  <BlockStack gap="300">
                    {setupSteps.map((step, i) => (
                      <InlineStack key={i} gap="300" blockAlign="start" wrap={false}>
                        <Box>
                          <Icon
                            source={CheckCircleIcon}
                            tone={step.done ? "success" : "subdued"}
                          />
                        </Box>
                        <Box width="100%">
                          <BlockStack gap="050">
                            <Text
                              as="p"
                              variant="bodyMd"
                              fontWeight="semibold"
                              tone={step.done ? "subdued" : undefined}
                            >
                              {step.done ? <s>{step.label}</s> : step.label}
                            </Text>
                            {!step.done && (
                              <Text as="p" variant="bodySm" tone="subdued">
                                {step.description}
                              </Text>
                            )}
                          </BlockStack>
                        </Box>
                        {step.action && (
                          <Box>
                            <Button onClick={() => navigate(step.action.url)} size="slim">
                              {step.action.content}
                            </Button>
                          </Box>
                        )}
                      </InlineStack>
                    ))}
                  </BlockStack>
                </Box>
              </Collapsible>
            </BlockStack>
          </Card>
        )}

        <Layout>
          <Layout.Section>
            <InlineGrid columns={4} gap="400">
              <StatCard
                title="Connected Apps"
                value={connectedApps}
                icon={LinkIcon}
              >
                {connectedAppNames.length > 0 ? (
                  <InlineStack gap="100" wrap>
                    {connectedAppNames.map((name) => (
                      <Badge key={name} tone="success">
                        {name}
                      </Badge>
                    ))}
                  </InlineStack>
                ) : (
                  <Text as="p" variant="bodySm" tone="subdued">
                    None yet
                  </Text>
                )}
              </StatCard>

              <StatCard
                title="Total Subscriptions"
                value={subscriptionStats?.total?.toLocaleString() || "0"}
                icon={PersonIcon}
              >
                {subscriptionStats?.statusCounts?.active > 0 && (
                  <InlineStack>
                    <Badge tone="success">
                      {subscriptionStats.statusCounts.active} active
                    </Badge>
                  </InlineStack>
                )}
              </StatCard>

              <StatCard
                title="Exports This Month"
                value={monthlyExportCount}
                icon={ExportIcon}
              >
                <Text as="p" variant="bodySm" tone="subdued">
                  CSV, Excel, or Sheets
                </Text>
              </StatCard>

              <StatCard
                title="Active Schedules"
                value={scheduledCount}
                icon={ClockIcon}
              >
                <Text as="p" variant="bodySm" tone="subdued">
                  {scheduledCount > 0 ? "Auto-exporting" : "None scheduled"}
                </Text>
              </StatCard>
            </InlineGrid>
          </Layout.Section>
        </Layout>

        {subscriptionStats?.atRisk && (
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100" inlineAlign="start">
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Icon source={AlertCircleIcon} tone="critical" />
                  <Text as="h2" variant="headingMd" fontWeight="semibold">
                    Needs Attention
                  </Text>
                </div>
                <Text as="p" variant="bodySm" tone="subdued">
                  Subscribers at risk of churn — click any tile to investigate
                </Text>
              </BlockStack>

              <Divider />

              <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="300">
                <AtRiskTile
                  label="Failed payments"
                  value={subscriptionStats.atRisk.failed}
                  description="Need recovery"
                  icon={AlertTriangleIcon}
                  tone="critical"
                  onClick={() => navigate("/app/preview?status=failed")}
                />
                <AtRiskTile
                  label="Overdue charges"
                  value={subscriptionStats.atRisk.overdue}
                  description="Missed billing"
                  icon={ClockIcon}
                  tone="critical"
                  onClick={() =>
                    navigate(
                      `/app/preview?status=active&next_charge_to=${subscriptionStats.atRisk.today}`,
                    )
                  }
                />
                <AtRiskTile
                  label="Paused"
                  value={subscriptionStats.atRisk.paused}
                  description="May reactivate"
                  icon={PauseCircleIcon}
                  tone="warning"
                  onClick={() => navigate("/app/preview?status=paused")}
                />
                <AtRiskTile
                  label="Cancelled (30d)"
                  value={subscriptionStats.atRisk.recentlyCancelled}
                  description="Recent churn"
                  icon={XSmallIcon}
                  tone="subdued"
                  onClick={() =>
                    navigate(
                      `/app/preview?cancellation_from=${subscriptionStats.atRisk.thirtyDaysAgo}`,
                    )
                  }
                />
              </InlineGrid>
            </BlockStack>
          </Card>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Recent Exports
                  </Text>
                  <Button onClick={() => navigate("/app/exports")} variant="plain">
                    View all
                  </Button>
                </InlineStack>

                {recentExports.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "numeric"]}
                    headings={["Date", "Format", "Status", "Rows"]}
                    rows={recentExportRows}
                    hasZebraStripingOnData
                    increasedTableDensity
                  />
                ) : (
                  <Box paddingBlock="400">
                    <BlockStack gap="200" inlineAlign="center">
                      <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                        No exports yet
                      </Text>
                      <Button onClick={() => navigate("/app/exports")} variant="primary">
                        Create your first export
                      </Button>
                    </BlockStack>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              {subscriptionStats && subscriptionStats.total > 0 ? (
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      Subscription Breakdown
                    </Text>
                    <Divider />
                    <StatusBar
                      label="Active"
                      count={subscriptionStats.statusCounts.active || 0}
                      total={subscriptionStats.total}
                      tone="primary"
                    />
                    <StatusBar
                      label="Paused"
                      count={subscriptionStats.statusCounts.paused || 0}
                      total={subscriptionStats.total}
                      tone="primary"
                    />
                    <StatusBar
                      label="Cancelled"
                      count={subscriptionStats.statusCounts.cancelled || 0}
                      total={subscriptionStats.total}
                      tone="critical"
                    />
                    <StatusBar
                      label="Expired"
                      count={subscriptionStats.statusCounts.expired || 0}
                      total={subscriptionStats.total}
                      tone="primary"
                    />
                    <Divider />
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" fontWeight="semibold">
                        Total Revenue
                      </Text>
                      <Text as="span" variant="bodySm" fontWeight="semibold">
                        ${Number(subscriptionStats.totalRevenue).toLocaleString()}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </Card>
              ) : (
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      Subscription Breakdown
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Connect an app to see your subscription stats here.
                    </Text>
                  </BlockStack>
                </Card>
              )}

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Quick Actions
                  </Text>
                  <Divider />
                  <InlineGrid columns={2} gap="200">
                    <Button onClick={() => navigate("/app/connections")} icon={LinkIcon} fullWidth>
                      Connections
                    </Button>
                    <Button onClick={() => navigate("/app/preview")} icon={ViewIcon} fullWidth>
                      Preview
                    </Button>
                    <Button onClick={() => navigate("/app/exports")} icon={ExportIcon} fullWidth>
                      Export
                    </Button>
                    <Button onClick={() => navigate("/app/settings")} icon={SettingsIcon} fullWidth>
                      Settings
                    </Button>
                  </InlineGrid>
                </BlockStack>
              </Card>
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
