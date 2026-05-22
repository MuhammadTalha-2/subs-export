import { useState, useCallback } from "react";
import { useLoaderData, useSearchParams, useNavigation, useNavigate } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  DataTable,
  TextField,
  ChoiceList,
  EmptyState,
  Spinner,
  Banner,
  Box,
  Divider,
  Icon,
  Collapsible,
  ButtonGroup,
} from "@shopify/polaris";
import {
  FilterIcon,
  ViewIcon,
  SearchIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@shopify/polaris-icons";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../utils/shop.server";
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
import { applyFilters, parseFiltersFromParams } from "../utils/filters.server";
import { UNIFIED_FIELDS, STATUS_VALUES } from "../utils/unified-schema";

const PREVIEW_LIMIT = 50;

const DEFAULT_VISIBLE_COLUMNS = [
  "customer_email",
  "customer_first_name",
  "customer_last_name",
  "subscription_status",
  "product_title",
  "quantity",
  "price_per_cycle",
  "currency",
  "billing_interval",
  "next_charge_date",
  "subscription_start_date",
];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  const connections = await db.appConnection.findMany({
    where: { shopId: shop.id, status: "connected" },
  });

  if (connections.length === 0) {
    return {
      rows: [],
      totalFetched: 0,
      connectedApps: [],
      error: null,
    };
  }

  const url = new URL(request.url);
  const filters = parseFiltersFromParams(url.searchParams);

  let allRows = [];
  const connectedApps = [];
  let error = null;

  for (const conn of connections) {
    try {
      if (conn.appName === "demo") {
        allRows.push(...generateDemoData(150));
        connectedApps.push("demo");
      } else if (conn.appName === "recharge") {
        const apiKey = decrypt(conn.apiKeyEnc);
        const rawSubs = await fetchRechargeSubscriptions(apiKey, {
          limit: 500,
        });
        const mapped = rawSubs.map(mapRechargeToUnified);
        allRows.push(...mapped);
        connectedApps.push("recharge");
      } else if (conn.appName === "seal") {
        const apiKey = decrypt(conn.apiKeyEnc);
        const rawSubs = await fetchSealSubscriptions(apiKey, {
          limit: 500,
        });
        const mapped = rawSubs.map(mapSealToUnified);
        allRows.push(...mapped);
        connectedApps.push("seal");
      } else if (conn.appName === "skio") {
        const apiKey = decrypt(conn.apiKeyEnc);
        const rawSubs = await fetchSkioSubscriptions(apiKey, {
          limit: 500,
        });
        const mapped = rawSubs.map(mapSkioToUnified);
        allRows.push(...mapped);
        connectedApps.push("skio");
      } else if (conn.appName === "loop") {
        const apiKey = decrypt(conn.apiKeyEnc);
        const rawSubs = await fetchLoopSubscriptions(apiKey, {
          limit: 500,
        });
        const mapped = rawSubs.map(mapLoopToUnified);
        allRows.push(...mapped);
        connectedApps.push("loop");
      } else if (conn.appName === "paywhirl") {
        const creds = JSON.parse(decrypt(conn.apiKeyEnc));
        const rawSubs = await fetchPayWhirlSubscriptions(creds, {
          limit: 500,
        });
        const mapped = rawSubs.map(mapPayWhirlToUnified);
        allRows.push(...mapped);
        connectedApps.push("paywhirl");
      } else if (conn.appName === "bold") {
        const creds = JSON.parse(decrypt(conn.apiKeyEnc));
        const rawSubs = await fetchBoldSubscriptions(creds, {
          limit: 500,
        });
        const mapped = rawSubs.map(mapBoldToUnified);
        allRows.push(...mapped);
        connectedApps.push("bold");
      }
    } catch (err) {
      console.error(`Error fetching from ${conn.appName}:`, err.message);
      error = `Failed to fetch from ${conn.appName}: ${err.message}`;
    }
  }

  const filtered = applyFilters(allRows, filters);

  const statusCounts = {};
  for (const row of allRows) {
    const s = row.subscription_status || "unknown";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  return {
    rows: filtered.slice(0, PREVIEW_LIMIT),
    totalFetched: filtered.length,
    totalUnfiltered: allRows.length,
    connectedApps,
    statusCounts,
    error,
  };
};

export default function PreviewPage() {
  const {
    rows,
    totalFetched,
    totalUnfiltered,
    connectedApps,
    statusCounts,
    error,
  } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const isFilterLoading =
    navigation.state === "loading" &&
    navigation.location?.pathname === "/app/preview";

  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [statusFilter, setStatusFilter] = useState(
    searchParams.getAll("status"),
  );
  const [productFilter, setProductFilter] = useState(
    searchParams.get("product") || "",
  );
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const hasActiveFilters = statusFilter.length > 0 || productFilter.length > 0;

  const handleFilterChange = useCallback(() => {
    const params = new URLSearchParams();
    statusFilter.forEach((s) => params.append("status", s));
    if (productFilter) params.set("product", productFilter);
    setSearchParams(params);
  }, [statusFilter, productFilter, setSearchParams]);

  const handleClearFilters = useCallback(() => {
    setStatusFilter([]);
    setProductFilter("");
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const activeFields = UNIFIED_FIELDS.filter((f) =>
    visibleColumns.includes(f.key),
  );

  const tableHeadings = activeFields.map((f) => f.label);
  const tableRows = rows.map((row) =>
    activeFields.map((f) => {
      const val = row[f.key];
      if (val === null || val === undefined || val === "") return "—";
      if (f.type === "decimal") return Number(val).toFixed(2);
      return String(val);
    }),
  );

  if (connectedApps.length === 0) {
    return (
      <Page>
        <ui-title-bar title="Preview" />
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading="No apps connected"
                action={{
                  content: "Connect an app",
                  onAction: () => navigate("/app/connections"),
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Connect a subscription app first to preview your data.
                </p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page>
      <ui-title-bar title="Preview">
        <button
          variant="primary"
          onClick={() => navigate("/app/exports")}
          disabled={rows.length === 0 ? "" : null}
        >
          Export
        </button>
      </ui-title-bar>
      <BlockStack gap="400">
        {error && (
          <Banner tone="warning">
            <p>{error}</p>
          </Banner>
        )}

        <InlineStack gap="300" wrap>
          <Badge tone="info">
            {totalUnfiltered} total subscriptions
          </Badge>
          {connectedApps.map((app) => (
            <Badge key={app} tone="success">{app}</Badge>
          ))}
          {Object.entries(statusCounts).map(([status, count]) => (
            <Badge key={status}>
              {count} {status}
            </Badge>
          ))}
        </InlineStack>

        <Layout>
          <Layout.Section variant="oneThird">
            <BlockStack gap="300">
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={FilterIcon} tone="subdued" />
                      <Text as="h2" variant="headingMd">
                        Filters
                      </Text>
                      {hasActiveFilters && (
                        <Badge tone="attention">
                          {statusFilter.length + (productFilter ? 1 : 0)}
                        </Badge>
                      )}
                    </InlineStack>
                    <Button
                      icon={filtersOpen ? ChevronUpIcon : ChevronDownIcon}
                      variant="tertiary"
                      onClick={() => setFiltersOpen((o) => !o)}
                      accessibilityLabel={filtersOpen ? "Collapse filters" : "Expand filters"}
                    />
                  </InlineStack>

                  <Collapsible open={filtersOpen} id="filters-collapsible">
                    <BlockStack gap="300">
                      <ChoiceList
                        title="Status"
                        allowMultiple
                        choices={STATUS_VALUES.map((s) => ({
                          label: s.charAt(0).toUpperCase() + s.slice(1),
                          value: s,
                        }))}
                        selected={statusFilter}
                        onChange={setStatusFilter}
                      />

                      <TextField
                        label="Product / SKU"
                        value={productFilter}
                        onChange={setProductFilter}
                        placeholder="Search product, variant, or SKU"
                        autoComplete="off"
                        prefix={<Icon source={SearchIcon} tone="subdued" />}
                      />

                      <InlineStack gap="200">
                        <Button variant="primary" onClick={handleFilterChange} loading={isFilterLoading}>
                          Apply Filters
                        </Button>
                        {hasActiveFilters && (
                          <Button onClick={handleClearFilters}>Clear</Button>
                        )}
                      </InlineStack>
                    </BlockStack>
                  </Collapsible>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={ViewIcon} tone="subdued" />
                      <Text as="h2" variant="headingMd">
                        Columns
                      </Text>
                      <Badge>{visibleColumns.length} of {UNIFIED_FIELDS.length}</Badge>
                    </InlineStack>
                    <Button
                      icon={columnsOpen ? ChevronUpIcon : ChevronDownIcon}
                      variant="tertiary"
                      onClick={() => setColumnsOpen((o) => !o)}
                      accessibilityLabel={columnsOpen ? "Collapse columns" : "Expand columns"}
                    />
                  </InlineStack>

                  <Collapsible open={columnsOpen} id="columns-collapsible">
                    <BlockStack gap="200">
                      <ChoiceList
                        title="Visible columns"
                        titleHidden
                        allowMultiple
                        choices={UNIFIED_FIELDS.map((f) => ({
                          label: f.label,
                          value: f.key,
                        }))}
                        selected={visibleColumns}
                        onChange={setVisibleColumns}
                      />
                      <ButtonGroup>
                        <Button
                          size="slim"
                          onClick={() => setVisibleColumns(UNIFIED_FIELDS.map((f) => f.key))}
                        >
                          Select All
                        </Button>
                        <Button
                          size="slim"
                          onClick={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}
                        >
                          Reset
                        </Button>
                      </ButtonGroup>
                    </BlockStack>
                  </Collapsible>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Subscription Data
                    </Text>
                    <Badge>
                      {totalFetched > PREVIEW_LIMIT
                        ? `Showing ${PREVIEW_LIMIT} of ${totalFetched}`
                        : `${rows.length} records`}
                    </Badge>
                  </InlineStack>
                  {isFilterLoading && <Spinner size="small" />}
                </InlineStack>

                <Divider />

                {rows.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <DataTable
                      columnContentTypes={activeFields.map((f) =>
                        f.type === "decimal" || f.type === "integer"
                          ? "numeric"
                          : "text",
                      )}
                      headings={tableHeadings}
                      rows={tableRows}
                      stickyHeader
                      hasZebraStripingOnData
                      increasedTableDensity
                    />
                  </div>
                ) : (
                  <Box paddingBlock="600">
                    <BlockStack gap="200" inlineAlign="center">
                      <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                        No subscriptions match the current filters.
                      </Text>
                      {hasActiveFilters && (
                        <Button onClick={handleClearFilters}>
                          Clear filters
                        </Button>
                      )}
                    </BlockStack>
                  </Box>
                )}

                {rows.length > 0 && totalFetched > PREVIEW_LIMIT && (
                  <>
                    <Divider />
                    <InlineStack align="center">
                      <Text as="p" variant="bodySm" tone="subdued">
                        Showing first {PREVIEW_LIMIT} of {totalFetched} records. Export to see all data.
                      </Text>
                    </InlineStack>
                  </>
                )}
              </BlockStack>
            </Card>
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
