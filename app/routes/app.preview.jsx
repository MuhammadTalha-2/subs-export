import { useState, useCallback, useEffect } from "react";
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
  Select,
  ChoiceList,
  Pagination,
  Spinner,
  Banner,
  Box,
  Divider,
  Icon,
  Collapsible,
  ButtonGroup,
  Modal,
  Tooltip,
} from "@shopify/polaris";
import {
  FilterIcon,
  ViewIcon,
  SearchIcon,
  ChevronRightIcon,
  LinkIcon,
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

const MAX_FETCH = 5000;
const PAGE_SIZE_OPTIONS = [
  { label: "25 per page", value: "25" },
  { label: "50 per page", value: "50" },
  { label: "100 per page", value: "100" },
  { label: "250 per page", value: "250" },
];

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

  const capped = filtered.slice(0, MAX_FETCH);

  return {
    rows: capped,
    totalFetched: filtered.length,
    totalCapped: capped.length,
    totalUnfiltered: allRows.length,
    cap: MAX_FETCH,
    connectedApps,
    statusCounts,
    error,
  };
};

export default function PreviewPage() {
  const {
    rows,
    totalFetched,
    totalCapped,
    totalUnfiltered,
    cap,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState("50");
  const [pageIndex, setPageIndex] = useState(0);
  const [sortColumnIndex, setSortColumnIndex] = useState(null);
  const [sortDirection, setSortDirection] = useState("ascending");
  const [openPanel, setOpenPanel] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const filtersOpen = openPanel === "filters";
  const columnsOpen = openPanel === "columns";
  const togglePanel = (panel) =>
    setOpenPanel((current) => (current === panel ? null : panel));

  const hasActiveFilters =
    statusFilter.length > 0 || productFilter.length > 0 || searchQuery.length > 0;

  const handleFilterChange = useCallback(() => {
    const params = new URLSearchParams();
    statusFilter.forEach((s) => params.append("status", s));
    if (productFilter) params.set("product", productFilter);
    setSearchParams(params);
  }, [statusFilter, productFilter, setSearchParams]);

  const handleClearFilters = useCallback(() => {
    setStatusFilter([]);
    setProductFilter("");
    setSearchQuery("");
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const activeFields = UNIFIED_FIELDS.filter((f) =>
    visibleColumns.includes(f.key),
  );

  const searchedRows = (() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const fields = [
        row.customer_email,
        row.customer_first_name,
        row.customer_last_name,
        row.customer_phone,
        row.product_title,
        row.variant_title,
        row.sku,
        row.subscription_id,
        row.customer_id,
      ];
      return fields.some(
        (v) => v && String(v).toLowerCase().includes(q),
      );
    });
  })();

  const sortedRows = (() => {
    if (sortColumnIndex === null || !activeFields[sortColumnIndex]) {
      return searchedRows;
    }
    const field = activeFields[sortColumnIndex];
    const direction = sortDirection === "descending" ? -1 : 1;
    const copy = [...searchedRows];
    copy.sort((a, b) => {
      const va = a[field.key];
      const vb = b[field.key];
      const aEmpty = va === null || va === undefined || va === "";
      const bEmpty = vb === null || vb === undefined || vb === "";
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      if (field.type === "decimal" || field.type === "integer") {
        return (parseFloat(va) - parseFloat(vb)) * direction;
      }
      if (field.type === "date") {
        return (new Date(va).getTime() - new Date(vb).getTime()) * direction;
      }
      return String(va).localeCompare(String(vb)) * direction;
    });
    return copy;
  })();

  const size = parseInt(pageSize, 10) || 50;
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / size));
  const currentPage = Math.min(pageIndex, totalPages - 1);
  const pageStart = currentPage * size;
  const pageEnd = Math.min(pageStart + size, sortedRows.length);
  const pagedRows = sortedRows.slice(pageStart, pageEnd);

  useEffect(() => {
    setPageIndex(0);
  }, [pageSize, sortedRows.length, searchQuery]);

  const handleSort = useCallback((index, dir) => {
    setSortColumnIndex(index);
    setSortDirection(dir);
  }, []);

  const statusToneMap = {
    active: "success",
    paused: "attention",
    cancelled: "critical",
    expired: undefined,
    failed: "critical",
  };

  function formatDateDisplay(value) {
    if (!value) return null;
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return value;
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return value;
    }
  }

  function renderCell(field, row) {
    const val = row[field.key];
    if (val === null || val === undefined || val === "") {
      return (
        <Text as="span" variant="bodySm" tone="subdued">
          —
        </Text>
      );
    }

    if (field.key === "subscription_status") {
      const tone = statusToneMap[String(val).toLowerCase()];
      const label = String(val).charAt(0).toUpperCase() + String(val).slice(1);
      return <Badge tone={tone}>{label}</Badge>;
    }

    if (field.type === "date") {
      return (
        <Text as="span" variant="bodySm">
          {formatDateDisplay(val)}
        </Text>
      );
    }

    if (field.type === "decimal") {
      const num = parseFloat(val);
      const currency = row.currency || "USD";
      const formatted = isNaN(num) ? String(val) : num.toFixed(2);
      if (field.key === "price_per_cycle" || field.key === "total_revenue_to_date") {
        return (
          <Text as="span" variant="bodySm" fontWeight="medium">
            {formatted} {currency}
          </Text>
        );
      }
      return (
        <Text as="span" variant="bodySm">
          {formatted}
        </Text>
      );
    }

    if (field.type === "integer") {
      return (
        <Text as="span" variant="bodySm" fontWeight="medium">
          {Number(val).toLocaleString()}
        </Text>
      );
    }

    if (field.key === "customer_email") {
      return (
        <Text as="span" variant="bodySm" truncate>
          {String(val)}
        </Text>
      );
    }

    if (field.key === "product_title" || field.key === "variant_title") {
      return (
        <Text as="span" variant="bodySm" fontWeight="medium">
          {String(val)}
        </Text>
      );
    }

    return (
      <Text as="span" variant="bodySm">
        {String(val)}
      </Text>
    );
  }

  const tableHeadings = [...activeFields.map((f) => f.label), ""];
  const tableRows = pagedRows.map((row, rowIdx) => [
    ...activeFields.map((f) => renderCell(f, row)),
    <Tooltip key={`view-${rowIdx}`} content="View details">
      <Button
        icon={ChevronRightIcon}
        variant="tertiary"
        size="slim"
        onClick={() => setSelectedRow(row)}
        accessibilityLabel="View subscription details"
      />
    </Tooltip>,
  ]);

  const sortableArray = [
    ...activeFields.map(() => true),
    false,
  ];

  const columnContentTypes = [
    ...activeFields.map((f) =>
      f.type === "decimal" || f.type === "integer" ? "numeric" : "text",
    ),
    "text",
  ];

  if (connectedApps.length === 0) {
    return (
      <Page>
        <ui-title-bar title="Preview" />
        <Card>
          <Box paddingBlock="1000">
            <BlockStack gap="400" inlineAlign="center">
              <Box
                background="bg-surface-secondary"
                padding="400"
                borderRadius="full"
              >
                <Icon source={ViewIcon} tone="subdued" />
              </Box>
              <BlockStack gap="100" inlineAlign="center">
                <Text as="p" variant="headingMd">
                  Nothing to preview yet
                </Text>
                <Text
                  as="p"
                  variant="bodyMd"
                  tone="subdued"
                  alignment="center"
                >
                  Connect a subscription app to see all your subscribers in
                  one unified view — searchable, sortable, and filterable.
                </Text>
              </BlockStack>
              <Button
                variant="primary"
                icon={LinkIcon}
                onClick={() => navigate("/app/connections")}
              >
                Connect your first app
              </Button>
            </BlockStack>
          </Box>
        </Card>
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

        <Card>
          <BlockStack gap="300">
            <InlineStack gap="300" align="space-between" blockAlign="center" wrap>
              <InlineStack gap="200" blockAlign="center" wrap>
                <Button
                  icon={FilterIcon}
                  onClick={() => togglePanel("filters")}
                  pressed={filtersOpen}
                >
                  Filters
                  {hasActiveFilters
                    ? ` (${statusFilter.length + (productFilter ? 1 : 0)})`
                    : ""}
                </Button>
                <Button
                  icon={ViewIcon}
                  onClick={() => togglePanel("columns")}
                  pressed={columnsOpen}
                >
                  Columns ({visibleColumns.length}/{UNIFIED_FIELDS.length})
                </Button>
                {hasActiveFilters && (
                  <Button variant="plain" onClick={handleClearFilters}>
                    Clear all
                  </Button>
                )}
              </InlineStack>
              <Box minWidth="320px">
                <TextField
                  label="Search subscriptions"
                  labelHidden
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search email, name, product, SKU…"
                  autoComplete="off"
                  prefix={<Icon source={SearchIcon} tone="subdued" />}
                  clearButton
                  onClearButtonClick={() => setSearchQuery("")}
                />
              </Box>
            </InlineStack>

            <Collapsible open={filtersOpen} id="filters-collapsible">
              <Box paddingBlockStart="200">
                <BlockStack gap="300">
                  <Divider />
                  <ChoiceList
                    title="Filter by status"
                    allowMultiple
                    choices={STATUS_VALUES.map((s) => ({
                      label: s.charAt(0).toUpperCase() + s.slice(1),
                      value: s,
                    }))}
                    selected={statusFilter}
                    onChange={setStatusFilter}
                  />
                  <InlineStack gap="200">
                    <Button
                      variant="primary"
                      onClick={handleFilterChange}
                      loading={isFilterLoading}
                    >
                      Apply Filters
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Box>
            </Collapsible>

            <Collapsible open={columnsOpen} id="columns-collapsible">
              <Box paddingBlockStart="200">
                <BlockStack gap="300">
                  <Divider />
                  <InlineStack gap="200" blockAlign="center" align="space-between">
                    <Text as="h3" variant="headingSm">
                      Visible columns
                    </Text>
                    <ButtonGroup>
                      <Button
                        size="slim"
                        onClick={() => setVisibleColumns(UNIFIED_FIELDS.map((f) => f.key))}
                      >
                        Select all
                      </Button>
                      <Button
                        size="slim"
                        onClick={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}
                      >
                        Reset
                      </Button>
                    </ButtonGroup>
                  </InlineStack>
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
              </Box>
            </Collapsible>
          </BlockStack>
        </Card>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center" wrap>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Subscription Data
                    </Text>
                    <Badge>
                      {totalFetched.toLocaleString()}{" "}
                      {totalFetched === 1 ? "record" : "records"}
                    </Badge>
                    {isFilterLoading && <Spinner size="small" />}
                  </InlineStack>
                  {rows.length > 0 && (
                    <Box minWidth="160px">
                      <Select
                        label="Page size"
                        labelHidden
                        options={PAGE_SIZE_OPTIONS}
                        value={pageSize}
                        onChange={setPageSize}
                      />
                    </Box>
                  )}
                </InlineStack>

                <Divider />

                {sortedRows.length > 0 ? (
                  <div
                    style={{
                      overflowX: "auto",
                      marginInline: "calc(-1 * var(--p-space-400))",
                      paddingInline: "var(--p-space-400)",
                    }}
                  >
                    <DataTable
                      columnContentTypes={columnContentTypes}
                      headings={tableHeadings}
                      rows={tableRows}
                      sortable={sortableArray}
                      defaultSortDirection="ascending"
                      initialSortColumnIndex={sortColumnIndex ?? undefined}
                      onSort={handleSort}
                      stickyHeader
                    />
                  </div>
                ) : (
                  <Box paddingBlock="800">
                    <BlockStack gap="300" inlineAlign="center">
                      <Box
                        background="bg-surface-secondary"
                        padding="300"
                        borderRadius="full"
                      >
                        <Icon source={SearchIcon} tone="subdued" />
                      </Box>
                      <BlockStack gap="100" inlineAlign="center">
                        <Text as="p" variant="headingSm">
                          No matches found
                        </Text>
                        <Text
                          as="p"
                          variant="bodySm"
                          tone="subdued"
                          alignment="center"
                        >
                          {hasActiveFilters
                            ? "Try adjusting your search or filters to find what you're looking for."
                            : "Your connected apps returned no subscriptions yet."}
                        </Text>
                      </BlockStack>
                      {hasActiveFilters && (
                        <Button onClick={handleClearFilters}>
                          Clear all filters
                        </Button>
                      )}
                    </BlockStack>
                  </Box>
                )}

                {sortedRows.length > 0 && (
                  <>
                    <Divider />
                    <InlineStack align="space-between" blockAlign="center" wrap>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Showing {(pageStart + 1).toLocaleString()}–
                        {pageEnd.toLocaleString()} of{" "}
                        {sortedRows.length.toLocaleString()}
                        {searchQuery
                          ? ` filtered from ${rows.length.toLocaleString()}`
                          : ""}
                        {totalFetched > cap
                          ? ` (capped at ${cap.toLocaleString()} — export for the full set)`
                          : ""}
                      </Text>
                      {totalPages > 1 && (
                        <Pagination
                          label={`Page ${currentPage + 1} of ${totalPages}`}
                          hasPrevious={currentPage > 0}
                          onPrevious={() => setPageIndex((p) => Math.max(0, p - 1))}
                          hasNext={currentPage < totalPages - 1}
                          onNext={() =>
                            setPageIndex((p) => Math.min(totalPages - 1, p + 1))
                          }
                        />
                      )}
                    </InlineStack>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Box paddingBlockEnd="400" />
      </BlockStack>

      {selectedRow && (
        <Modal
          open
          onClose={() => setSelectedRow(null)}
          title="Subscription details"
          large
          secondaryActions={[
            {
              content: "Close",
              onAction: () => setSelectedRow(null),
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h3" variant="headingMd">
                  {selectedRow.customer_first_name}{" "}
                  {selectedRow.customer_last_name}
                </Text>
                <Badge
                  tone={
                    statusToneMap[
                      String(selectedRow.subscription_status).toLowerCase()
                    ]
                  }
                >
                  {String(selectedRow.subscription_status)
                    .charAt(0)
                    .toUpperCase() +
                    String(selectedRow.subscription_status).slice(1)}
                </Badge>
                {selectedRow._source && (
                  <Badge>{selectedRow._source}</Badge>
                )}
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="subdued">
                {selectedRow.customer_email}
              </Text>

              <Divider />

              <BlockStack gap="200">
                {UNIFIED_FIELDS.map((field) => {
                  const val = selectedRow[field.key];
                  const display =
                    val === null || val === undefined || val === ""
                      ? "—"
                      : field.type === "date"
                        ? formatDateDisplay(val)
                        : field.type === "decimal"
                          ? Number(val).toFixed(2)
                          : String(val);
                  return (
                    <InlineStack
                      key={field.key}
                      align="space-between"
                      blockAlign="start"
                      gap="400"
                      wrap={false}
                    >
                      <Text
                        as="span"
                        variant="bodySm"
                        tone="subdued"
                      >
                        {field.label}
                      </Text>
                      <Text as="span" variant="bodySm">
                        {display}
                      </Text>
                    </InlineStack>
                  );
                })}
              </BlockStack>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
