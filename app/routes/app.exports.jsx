import { useState, useCallback, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
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
  ChoiceList,
  EmptyState,
  Banner,
  Divider,
  Box,
  Icon,
  InlineGrid,
  Tooltip,
} from "@shopify/polaris";
import {
  ExportIcon,
  DeleteIcon,
  ImportIcon,
  ExternalIcon,
  CheckCircleIcon,
  FileIcon,
} from "@shopify/polaris-icons";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../utils/shop.server";
import {
  processExport,
  checkExportLimits,
  deleteExportFile,
} from "../services/export.server";
import { getGoogleAuthStatus } from "../services/google-auth.server";

const MONTHLY_LIMIT = 50;

const STATUS_FILTERS = [
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Expired", value: "expired" },
  { label: "Failed", value: "failed" },
];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  const connections = await db.appConnection.findMany({
    where: { shopId: shop.id, status: "connected" },
  });

  const exports = await db.exportJob.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const limitCheck = await checkExportLimits(shop);
  const googleAuth = await getGoogleAuthStatus(shop.id);

  let totalRowsExported = 0;
  let completedCount = 0;
  for (const e of exports) {
    if (e.status === "complete" && e.rowCount) {
      totalRowsExported += e.rowCount;
      completedCount++;
    }
  }

  return {
    exports: exports.map((e) => ({
      id: e.id,
      format: e.format,
      status: e.status,
      rowCount: e.rowCount,
      filePath: e.filePath,
      errorMessage: e.errorMessage,
      createdAt: e.createdAt,
      completedAt: e.completedAt,
      filters: e.filtersJson,
    })),
    hasConnections: connections.length > 0,
    exportCount: shop.monthlyExportCount,
    canExport: limitCheck.allowed,
    limitMessage: limitCheck.reason || null,
    googleConnected: googleAuth.connected,
    totalRowsExported,
    completedCount,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const limitCheck = await checkExportLimits(shop);
    if (!limitCheck.allowed) {
      return { error: limitCheck.reason };
    }

    const format = formData.get("format") || "csv";
    const statusFilter = formData.getAll("status");
    const filters = {};
    if (statusFilter.length > 0) filters.status = statusFilter;

    const job = await db.exportJob.create({
      data: {
        shopId: shop.id,
        format,
        filtersJson: Object.keys(filters).length > 0 ? filters : undefined,
        status: "queued",
      },
    });

    try {
      await processExport(job.id);
      return { success: "Export completed successfully." };
    } catch (error) {
      return { error: `Export failed: ${error.message}` };
    }
  }

  if (intent === "delete") {
    const jobId = formData.get("jobId");
    const job = await db.exportJob.findFirst({
      where: { id: jobId, shopId: shop.id },
    });

    if (job) {
      await deleteExportFile(job.filePath);
      await db.exportJob.delete({ where: { id: jobId } });
      return { success: "Export deleted." };
    }

    return { error: "Export not found." };
  }

  return { error: "Unknown action." };
};

function StatusBadge({ status }) {
  const config = {
    queued: { tone: "info", label: "Queued" },
    processing: { tone: "attention", label: "Processing" },
    complete: { tone: "success", label: "Complete" },
    failed: { tone: "critical", label: "Failed" },
  };
  const { tone, label } = config[status] || { tone: undefined, label: status };
  return <Badge tone={tone}>{label}</Badge>;
}

function StatTile({ label, value, sublabel, icon, iconBg, iconTone }) {
  return (
    <Card>
      <InlineStack gap="400" blockAlign="center" wrap={false}>
        <Box
          background={iconBg || "bg-surface-secondary"}
          padding="300"
          borderRadius="200"
        >
          <Icon source={icon} tone={iconTone || "subdued"} />
        </Box>
        <BlockStack gap="050">
          <Text as="span" variant="bodySm" tone="subdued">
            {label}
          </Text>
          <Text as="p" variant="heading2xl" fontWeight="bold">
            {value}
          </Text>
          {sublabel && (
            <Text as="span" variant="bodySm" tone="subdued">
              {sublabel}
            </Text>
          )}
        </BlockStack>
      </InlineStack>
    </Card>
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatLabel(fmt) {
  if (fmt === "gsheets") return "Google Sheets";
  return fmt.toUpperCase();
}

function formatBadgeTone(fmt) {
  if (fmt === "csv") return "info";
  if (fmt === "xlsx") return "success";
  if (fmt === "gsheets") return "attention";
  return undefined;
}

export default function ExportsPage() {
  const {
    exports: exportList,
    hasConnections,
    exportCount,
    canExport,
    limitMessage,
    googleConnected,
    totalRowsExported,
    completedCount,
  } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [format, setFormat] = useState(["csv"]);
  const [statusFilter, setStatusFilter] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);

  const isSubmitting = fetcher.state !== "idle";
  const result = fetcher.data;

  useEffect(() => {
    if (!isSubmitting) setActiveJobId(null);
  }, [isSubmitting]);

  useEffect(() => {
    if (result?.success) {
      shopify.toast.show(result.success);
    } else if (result?.error) {
      shopify.toast.show(result.error, { isError: true });
    }
  }, [result]);

  const formatChoices = [
    {
      label: "CSV",
      value: "csv",
      helpText: "Universal spreadsheet format",
    },
    {
      label: "Excel (.xlsx)",
      value: "xlsx",
      helpText: "Microsoft Excel workbook",
    },
    {
      label: "Google Sheets",
      value: "gsheets",
      helpText: googleConnected
        ? "Pushed to your Google Drive"
        : "Connect Google in Settings to enable",
      disabled: !googleConnected,
    },
  ];

  const handleCreateExport = useCallback(() => {
    setActiveJobId("create");
    const formData = new FormData();
    formData.set("intent", "create");
    formData.set("format", format[0] || "csv");
    statusFilter.forEach((s) => formData.append("status", s));
    fetcher.submit(formData, { method: "POST" });
  }, [fetcher, format, statusFilter]);

  const handleDownload = useCallback(async (jobId, filename) => {
    try {
      const response = await fetch(`/app/exports/download/${jobId}`);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "export";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
    }
  }, []);

  const handleDelete = useCallback(
    (jobId) => {
      setActiveJobId(jobId);
      const formData = new FormData();
      formData.set("intent", "delete");
      formData.set("jobId", jobId);
      fetcher.submit(formData, { method: "POST" });
    },
    [fetcher],
  );

  if (!hasConnections) {
    return (
      <Page>
        <ui-title-bar title="Exports" />
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
                <p>Connect a subscription app first to start exporting data.</p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const isCreatingExport = isSubmitting && activeJobId === "create";

  const tableRows = exportList.map((exp) => [
    <BlockStack key={`date-${exp.id}`} gap="050">
      <Text as="span" variant="bodyMd" fontWeight="medium">
        {timeAgo(exp.createdAt)}
      </Text>
      <Text as="span" variant="bodySm" tone="subdued">
        {new Date(exp.createdAt).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </Text>
    </BlockStack>,
    <Badge key={`fmt-${exp.id}`} tone={formatBadgeTone(exp.format)}>
      {formatLabel(exp.format)}
    </Badge>,
    <StatusBadge key={`status-${exp.id}`} status={exp.status} />,
    <Text key={`rows-${exp.id}`} as="span" variant="bodyMd" fontWeight="medium">
      {exp.rowCount != null ? exp.rowCount.toLocaleString() : "—"}
    </Text>,
    <InlineStack key={`actions-${exp.id}`} gap="100" align="end">
      {exp.status === "complete" && exp.filePath && exp.format === "gsheets" && (
        <Tooltip content="Open in Google Sheets">
          <Button
            size="slim"
            icon={ExternalIcon}
            onClick={() => window.open(exp.filePath, "_blank")}
            accessibilityLabel="Open Sheet"
          />
        </Tooltip>
      )}
      {exp.status === "complete" && exp.filePath && exp.format !== "gsheets" && (
        <Tooltip content="Download file">
          <Button
            size="slim"
            icon={ImportIcon}
            onClick={() => handleDownload(exp.id, exp.filePath)}
            accessibilityLabel="Download"
          />
        </Tooltip>
      )}
      <Tooltip content="Delete export">
        <Button
          size="slim"
          icon={DeleteIcon}
          tone="critical"
          variant="tertiary"
          onClick={() => handleDelete(exp.id)}
          loading={isSubmitting && activeJobId === exp.id}
          accessibilityLabel="Delete"
        />
      </Tooltip>
    </InlineStack>,
  ]);

  return (
    <Page>
      <ui-title-bar title="Exports" />
      <BlockStack gap="500">
        {!canExport && limitMessage && (
          <Banner tone="warning">
            <p>{limitMessage}</p>
          </Banner>
        )}

        <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
          <StatTile
            label="This month"
            value={`${exportCount}`}
            sublabel={`of ${MONTHLY_LIMIT} exports`}
            icon={ExportIcon}
            iconBg="bg-surface-info"
            iconTone="info"
          />
          <StatTile
            label="Completed"
            value={completedCount.toLocaleString()}
            sublabel="successful exports"
            icon={CheckCircleIcon}
            iconBg="bg-surface-success"
            iconTone="success"
          />
          <StatTile
            label="Total rows"
            value={totalRowsExported.toLocaleString()}
            sublabel="across all exports"
            icon={FileIcon}
            iconBg="bg-surface-secondary"
            iconTone="subdued"
          />
        </InlineGrid>

        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Create Export
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Choose a format and optional filters
                  </Text>
                </BlockStack>

                <ChoiceList
                  title="Format"
                  choices={formatChoices}
                  selected={format}
                  onChange={setFormat}
                />

                <Divider />

                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      Filter by status
                    </Text>
                    {statusFilter.length > 0 && (
                      <Button
                        variant="plain"
                        size="micro"
                        onClick={() => setStatusFilter([])}
                      >
                        Clear
                      </Button>
                    )}
                  </InlineStack>
                  <ChoiceList
                    title="Status filter"
                    titleHidden
                    allowMultiple
                    choices={STATUS_FILTERS}
                    selected={statusFilter}
                    onChange={setStatusFilter}
                  />
                  {statusFilter.length === 0 && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      Exports all subscriptions when no filters selected
                    </Text>
                  )}
                </BlockStack>

                <Button
                  variant="primary"
                  icon={ExportIcon}
                  onClick={handleCreateExport}
                  loading={isCreatingExport}
                  disabled={!canExport}
                  fullWidth
                  size="large"
                >
                  {isCreatingExport ? "Exporting..." : "Create Export"}
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text as="h2" variant="headingMd">
                      Export History
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Your most recent exports
                    </Text>
                  </BlockStack>
                  {exportList.length > 0 && (
                    <Badge>{exportList.length} {exportList.length === 1 ? "export" : "exports"}</Badge>
                  )}
                </InlineStack>

                <Divider />

                {exportList.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "numeric", "text"]}
                    headings={["Date", "Format", "Status", "Rows", ""]}
                    rows={tableRows}
                    increasedTableDensity
                  />
                ) : (
                  <Box paddingBlock="800">
                    <BlockStack gap="300" inlineAlign="center">
                      <Icon source={ExportIcon} tone="subdued" />
                      <BlockStack gap="100" inlineAlign="center">
                        <Text as="p" variant="headingSm">
                          No exports yet
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                          Create your first export using the form on the left
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Box>
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
