import { useState, useCallback } from "react";
import { useLoaderData, useSearchParams, useNavigation } from "react-router";
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
} from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../utils/shop.server";
import { decrypt } from "../utils/encryption.server";
import {
  fetchRechargeSubscriptions,
  mapRechargeToUnified,
} from "../services/recharge.server";
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
      if (conn.appName === "recharge") {
        const apiKey = decrypt(conn.apiKeyEnc);
        const rawSubs = await fetchRechargeSubscriptions(apiKey, {
          limit: 500,
        });
        const mapped = rawSubs.map(mapRechargeToUnified);
        allRows.push(...mapped);
        connectedApps.push("recharge");
      }
    } catch (err) {
      console.error(`Error fetching from ${conn.appName}:`, err.message);
      error = `Failed to fetch from ${conn.appName}: ${err.message}`;
    }
  }

  const filtered = applyFilters(allRows, filters);

  return {
    rows: filtered.slice(0, PREVIEW_LIMIT),
    totalFetched: filtered.length,
    connectedApps,
    error,
  };
};

export default function PreviewPage() {
  const { rows, totalFetched, connectedApps, error } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [statusFilter, setStatusFilter] = useState(
    searchParams.getAll("status"),
  );
  const [productFilter, setProductFilter] = useState(
    searchParams.get("product") || "",
  );

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

  const toggleColumn = useCallback(
    (key) => {
      setVisibleColumns((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
      );
    },
    [],
  );

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
      <Page title="Preview" subtitle="Preview your subscription data before exporting">
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading="No apps connected"
                action={{
                  content: "Connect an app",
                  url: "/app/connections",
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
    <Page
      title="Preview"
      subtitle="Preview your subscription data before exporting"
      primaryAction={{
        content: "Export",
        url: "/app/exports",
        disabled: rows.length === 0,
      }}
    >
      <BlockStack gap="400">
        {error && (
          <Banner tone="warning">
            <p>{error}</p>
          </Banner>
        )}

        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Filters
                </Text>

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
                />

                <InlineStack gap="200">
                  <Button variant="primary" onClick={handleFilterChange}>
                    Apply Filters
                  </Button>
                  <Button onClick={handleClearFilters}>Clear</Button>
                </InlineStack>
              </BlockStack>
            </Card>

            <Box paddingBlockStart="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Columns
                  </Text>
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
                </BlockStack>
              </Card>
            </Box>
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
                  {isLoading && <Spinner size="small" />}
                </InlineStack>

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
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No subscriptions match the current filters.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
