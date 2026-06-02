import { useState, useCallback, useEffect } from "react";
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
import { computeCohortRetention } from "../utils/cohort.server";
import OnboardingTour, {
  shouldShowOnboarding,
  resetOnboarding,
} from "../components/OnboardingTour";
import { LockedFeature } from "../components/LockedFeature";
import { syncShopPlan } from "../services/billing.server";

export const loader = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = await getShopWithConnections(session.shop);

  // Sync the merchant's current plan from Shopify on every dashboard load —
  // the dashboard is the most common landing route after a billing change,
  // and we want gates to lift/lower the moment they return.
  const { tier: planTier } = await syncShopPlan(billing, shop.id);

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

      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
        .toISOString()
        .split("T")[0];
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000)
        .toISOString()
        .split("T")[0];

      const period = {
        newCurrent: 0,
        newPrevious: 0,
        churnedCurrent: 0,
        churnedPrevious: 0,
      };

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

        if (row.subscription_start_date) {
          if (
            row.subscription_start_date >= thirtyDaysAgo &&
            row.subscription_start_date <= today
          ) {
            period.newCurrent += 1;
          } else if (
            row.subscription_start_date >= sixtyDaysAgo &&
            row.subscription_start_date < thirtyDaysAgo
          ) {
            period.newPrevious += 1;
          }
        }

        if (row.cancellation_date) {
          if (
            row.cancellation_date >= thirtyDaysAgo &&
            row.cancellation_date <= today
          ) {
            period.churnedCurrent += 1;
          } else if (
            row.cancellation_date >= sixtyDaysAgo &&
            row.cancellation_date < thirtyDaysAgo
          ) {
            period.churnedPrevious += 1;
          }
        }
      }

      period.netCurrent = period.newCurrent - period.churnedCurrent;
      period.netPrevious = period.newPrevious - period.churnedPrevious;

      const cohortData = computeCohortRetention(allRows, 6);

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
        cohorts: cohortData,
        period,
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
    planTier,
  };
};

function retentionTone(rate) {
  if (rate === null) return null;
  if (rate >= 80) return { bg: "#d3f4e1", fg: "#0a5c2d" };
  if (rate >= 60) return { bg: "#e3f5d9", fg: "#3d6b1a" };
  if (rate >= 40) return { bg: "#fcf3d4", fg: "#7a5b00" };
  if (rate >= 20) return { bg: "#fbe2cc", fg: "#8a3d00" };
  return { bg: "#fcd9d9", fg: "#a01919" };
}

function CohortTable({ cohorts, monthsBack }) {
  const hasData = cohorts.some((c) => c.size > 0);

  if (!hasData) {
    return (
      <Box paddingBlock="400">
        <BlockStack gap="200" inlineAlign="center">
          <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
            Not enough historical data yet. Cohort insights appear once you have
            subscribers from at least one full month.
          </Text>
        </BlockStack>
      </Box>
    );
  }

  const offsetHeaders = [];
  for (let i = 0; i < monthsBack; i++) {
    offsetHeaders.push(i === 0 ? "Month 0" : `+${i}mo`);
  }

  const cellStyle = {
    padding: "10px 12px",
    fontSize: 13,
    textAlign: "center",
    borderBottom: "1px solid var(--p-color-border-secondary)",
    whiteSpace: "nowrap",
  };
  const headerCellStyle = {
    ...cellStyle,
    fontWeight: 600,
    color: "var(--p-color-text-secondary)",
    background: "var(--p-color-bg-surface-secondary)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  };
  const labelCellStyle = {
    ...cellStyle,
    textAlign: "left",
    fontWeight: 500,
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          minWidth: 640,
        }}
      >
        <thead>
          <tr>
            <th style={{ ...headerCellStyle, textAlign: "left" }}>Cohort</th>
            <th style={headerCellStyle}>Size</th>
            {offsetHeaders.map((h) => (
              <th key={h} style={headerCellStyle}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.key}>
              <td style={labelCellStyle}>{cohort.label}</td>
              <td style={{ ...cellStyle, color: "var(--p-color-text-secondary)" }}>
                {cohort.size.toLocaleString()}
              </td>
              {cohort.retention.map((cell, idx) => {
                if (cell.rate === null || cohort.size === 0) {
                  return (
                    <td
                      key={idx}
                      style={{ ...cellStyle, color: "var(--p-color-text-subdued)" }}
                    >
                      —
                    </td>
                  );
                }
                const tone = retentionTone(cell.rate);
                return (
                  <td
                    key={idx}
                    style={{
                      ...cellStyle,
                      background: tone?.bg,
                      color: tone?.fg,
                      fontWeight: 600,
                    }}
                    title={`${cell.retained} of ${cohort.size} retained`}
                  >
                    {cell.rate.toFixed(0)}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeriodTile({ label, current, previous, invertedTone }) {
  const diff = current - previous;
  const pct =
    previous === 0
      ? current === 0
        ? 0
        : null
      : ((diff / Math.abs(previous)) * 100);

  const isPositive = diff > 0;
  const isNegative = diff < 0;

  let toneColor = "var(--p-color-text-secondary)";
  if (invertedTone) {
    if (isNegative) toneColor = "#0a5c2d";
    if (isPositive) toneColor = "#a01919";
  } else {
    if (isPositive) toneColor = "#0a5c2d";
    if (isNegative) toneColor = "#a01919";
  }

  const arrow = isPositive ? "↑" : isNegative ? "↓" : "→";
  const deltaText =
    pct === null
      ? `+${Math.abs(diff)}`
      : `${arrow} ${Math.abs(pct).toFixed(0)}%`;

  return (
    <Card>
      <BlockStack gap="150">
        <Text as="span" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <Text as="span" variant="heading2xl" fontWeight="bold">
          {Math.abs(current).toLocaleString()}
          {current < 0 ? " (net loss)" : ""}
        </Text>
        <InlineStack gap="200" blockAlign="center">
          <span
            style={{
              color: toneColor,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {deltaText}
          </span>
          <Text as="span" variant="bodySm" tone="subdued">
            vs prior 30d ({previous})
          </Text>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

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
    planTier,
  } = useLoaderData();

  // Free merchants see at-risk alerts and cohort retention behind a blurred
  // upgrade prompt. Growth and Pro see them live.
  const lockAdvancedAnalytics = planTier === "free";

  const navigate = useNavigate();

  const [setupOpen, setSetupOpen] = useState(true);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    const shouldShow = shouldShowOnboarding({
      hasConnections: connectedApps > 0,
      hasExports: monthlyExportCount > 0,
    });
    if (shouldShow) {
      const t = setTimeout(() => setTourOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, [connectedApps, monthlyExportCount]);

  const handleReplayTour = useCallback(() => {
    resetOnboarding();
    setTourOpen(true);
  }, []);

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
                    variant="plain"
                    onClick={handleReplayTour}
                  >
                    Replay tour
                  </Button>
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
          <LockedFeature
            locked={lockAdvancedAnalytics}
            requiredPlan="growth"
            featureName="At-risk subscriber alerts"
            description="Spot failed payments, paused subscribers, and recent cancellations before they erode MRR."
          >
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
          </LockedFeature>
        )}

        {subscriptionStats?.period && (
          <BlockStack gap="300">
            <BlockStack gap="100" inlineAlign="start">
              <Text as="h2" variant="headingMd">
                Last 30 Days
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Subscription activity compared to the prior 30 days
              </Text>
            </BlockStack>

            <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="300">
              <PeriodTile
                label="New subscribers"
                current={subscriptionStats.period.newCurrent}
                previous={subscriptionStats.period.newPrevious}
              />
              <PeriodTile
                label="Churned"
                current={subscriptionStats.period.churnedCurrent}
                previous={subscriptionStats.period.churnedPrevious}
                invertedTone
              />
              <PeriodTile
                label="Net change"
                current={subscriptionStats.period.netCurrent}
                previous={subscriptionStats.period.netPrevious}
              />
              <PeriodTile
                label="Active total"
                current={subscriptionStats.statusCounts?.active || 0}
                previous={
                  (subscriptionStats.statusCounts?.active || 0) -
                  subscriptionStats.period.netCurrent
                }
              />
            </InlineGrid>
          </BlockStack>
        )}

        {subscriptionStats?.cohorts && (
          <LockedFeature
            locked={lockAdvancedAnalytics}
            requiredPlan="growth"
            featureName="Cohort retention analytics"
            description="See which signup months retain and which leak, month over month."
          >
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100" inlineAlign="start">
                  <Text as="h2" variant="headingMd">
                    Cohort Retention
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    % of subscribers from each signup month who are still active
                    N months later
                  </Text>
                </BlockStack>

                <Divider />

                <CohortTable
                  cohorts={subscriptionStats.cohorts.cohorts}
                  monthsBack={subscriptionStats.cohorts.monthsBack}
                />

                <Box paddingBlockStart="100">
                  <InlineStack gap="200" blockAlign="center" wrap>
                    <Text as="span" variant="bodySm" tone="subdued">
                      Retention scale:
                    </Text>
                    {[
                      { label: "≥80%", bg: "#d3f4e1", fg: "#0a5c2d" },
                      { label: "60–79%", bg: "#e3f5d9", fg: "#3d6b1a" },
                      { label: "40–59%", bg: "#fcf3d4", fg: "#7a5b00" },
                      { label: "20–39%", bg: "#fbe2cc", fg: "#8a3d00" },
                      { label: "<20%", bg: "#fcd9d9", fg: "#a01919" },
                    ].map((item) => (
                      <span
                        key={item.label}
                        style={{
                          padding: "2px 8px",
                          background: item.bg,
                          color: item.fg,
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 4,
                        }}
                      >
                        {item.label}
                      </span>
                    ))}
                  </InlineStack>
                </Box>
              </BlockStack>
            </Card>
          </LockedFeature>
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
                  <Box paddingBlock="600">
                    <BlockStack gap="300" inlineAlign="center">
                      <Box
                        background="bg-surface-secondary"
                        padding="300"
                        borderRadius="full"
                      >
                        <Icon source={ExportIcon} tone="subdued" />
                      </Box>
                      <BlockStack gap="100" inlineAlign="center">
                        <Text as="p" variant="headingSm">
                          No exports yet
                        </Text>
                        <Text
                          as="p"
                          variant="bodySm"
                          tone="subdued"
                          alignment="center"
                        >
                          Your export history will appear here once you create
                          your first one.
                        </Text>
                      </BlockStack>
                      <Button
                        onClick={() => navigate("/app/exports")}
                        variant="primary"
                      >
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

      <OnboardingTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
      />
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
