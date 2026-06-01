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
  Banner,
  Divider,
  Box,
  Icon,
  InlineGrid,
  Tooltip,
  Modal,
  TextField,
} from "@shopify/polaris";
import {
  ExportIcon,
  LinkIcon,
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

  let templates = [];
  try {
    templates = await db.exportTemplate.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("ExportTemplate read failed (migration may be pending):", err.message);
  }

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
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      format: t.format,
      filters: t.filtersJson,
      lastRunAt: t.lastRunAt,
      runCount: t.runCount,
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
      // Deleting the row drops the stored file bytes with it — no separate
      // disk cleanup needed now that exports live in Postgres.
      await db.exportJob.delete({ where: { id: jobId } });
      return { success: "Export deleted." };
    }

    return { error: "Export not found." };
  }

  if (intent === "save_template") {
    const name = (formData.get("name") || "").toString().trim();
    if (!name) {
      return { error: "Template name is required." };
    }
    const format = formData.get("format") || "csv";
    const statusFilter = formData.getAll("status");
    const filters = {};
    if (statusFilter.length > 0) filters.status = statusFilter;

    await db.exportTemplate.create({
      data: {
        shopId: shop.id,
        name,
        format,
        filtersJson: Object.keys(filters).length > 0 ? filters : undefined,
      },
    });

    return { success: `Template "${name}" saved.` };
  }

  if (intent === "run_template") {
    const limitCheck = await checkExportLimits(shop);
    if (!limitCheck.allowed) {
      return { error: limitCheck.reason };
    }

    const templateId = formData.get("templateId");
    const template = await db.exportTemplate.findFirst({
      where: { id: templateId, shopId: shop.id },
    });

    if (!template) {
      return { error: "Template not found." };
    }

    const job = await db.exportJob.create({
      data: {
        shopId: shop.id,
        format: template.format,
        filtersJson: template.filtersJson || undefined,
        status: "queued",
      },
    });

    try {
      await processExport(job.id);
      await db.exportTemplate.update({
        where: { id: template.id },
        data: {
          lastRunAt: new Date(),
          runCount: { increment: 1 },
        },
      });
      return { success: `Export from "${template.name}" completed.` };
    } catch (error) {
      return { error: `Export failed: ${error.message}` };
    }
  }

  if (intent === "delete_template") {
    const templateId = formData.get("templateId");
    await db.exportTemplate.deleteMany({
      where: { id: templateId, shopId: shop.id },
    });
    return { success: "Template deleted." };
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
    templates = [],
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
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");

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

  const handleSaveTemplate = useCallback(() => {
    if (!templateName.trim()) return;
    setActiveJobId("save_template");
    const formData = new FormData();
    formData.set("intent", "save_template");
    formData.set("name", templateName.trim());
    formData.set("format", format[0] || "csv");
    statusFilter.forEach((s) => formData.append("status", s));
    fetcher.submit(formData, { method: "POST" });
    setTemplateName("");
    setSaveModalOpen(false);
  }, [fetcher, templateName, format, statusFilter]);

  const handleRunTemplate = useCallback(
    (templateId) => {
      setActiveJobId(`run:${templateId}`);
      const formData = new FormData();
      formData.set("intent", "run_template");
      formData.set("templateId", templateId);
      fetcher.submit(formData, { method: "POST" });
    },
    [fetcher],
  );

  const handleDeleteTemplate = useCallback(
    (templateId) => {
      setActiveJobId(`delete:${templateId}`);
      const formData = new FormData();
      formData.set("intent", "delete_template");
      formData.set("templateId", templateId);
      fetcher.submit(formData, { method: "POST" });
    },
    [fetcher],
  );

  if (!hasConnections) {
    return (
      <Page>
        <ui-title-bar title="Exports" />
        <Card>
          <Box paddingBlock="1000">
            <BlockStack gap="400" inlineAlign="center">
              <Box
                background="bg-surface-secondary"
                padding="400"
                borderRadius="full"
              >
                <Icon source={ExportIcon} tone="subdued" />
              </Box>
              <BlockStack gap="100" inlineAlign="center">
                <Text as="p" variant="headingMd">
                  Nothing to export yet
                </Text>
                <Text
                  as="p"
                  variant="bodyMd"
                  tone="subdued"
                  alignment="center"
                >
                  Connect a subscription app to start exporting subscribers as
                  CSV, Excel, or Google Sheets — one click or on a schedule.
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

        {templates.length > 0 && (
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="050">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Saved Templates
                    </Text>
                    <Badge>{templates.length}</Badge>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    One-click re-run of saved export configs
                  </Text>
                </BlockStack>
              </InlineStack>

              <Divider />

              <InlineGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap="300">
                {templates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    style={{
                      padding: "16px",
                      border: "1px solid var(--p-color-border-secondary)",
                      borderRadius: "var(--p-border-radius-200)",
                      background: "var(--p-color-bg-surface)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "8px",
                      }}
                    >
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {tmpl.name}
                      </Text>
                      <Tooltip content="Delete template">
                        <Button
                          icon={DeleteIcon}
                          tone="critical"
                          variant="tertiary"
                          size="micro"
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                          loading={
                            isSubmitting &&
                            activeJobId === `delete:${tmpl.id}`
                          }
                          accessibilityLabel="Delete template"
                        />
                      </Tooltip>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                      }}
                    >
                      <Badge tone={formatBadgeTone(tmpl.format)}>
                        {formatLabel(tmpl.format)}
                      </Badge>
                      {tmpl.filters?.status?.length > 0 ? (
                        tmpl.filters.status.map((s) => (
                          <Badge key={s}>{s}</Badge>
                        ))
                      ) : (
                        <Badge>all statuses</Badge>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px",
                        marginTop: "auto",
                      }}
                    >
                      <Text as="span" variant="bodySm" tone="subdued">
                        {tmpl.runCount > 0
                          ? `${tmpl.runCount} run${tmpl.runCount === 1 ? "" : "s"} · ${timeAgo(tmpl.lastRunAt)}`
                          : "Never run"}
                      </Text>
                      <Button
                        variant="primary"
                        icon={ExportIcon}
                        size="slim"
                        onClick={() => handleRunTemplate(tmpl.id)}
                        loading={
                          isSubmitting && activeJobId === `run:${tmpl.id}`
                        }
                        disabled={!canExport}
                      >
                        Run
                      </Button>
                    </div>
                  </div>
                ))}
              </InlineGrid>
            </BlockStack>
          </Card>
        )}

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

                <BlockStack gap="200">
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
                  <Button
                    variant="tertiary"
                    onClick={() => setSaveModalOpen(true)}
                    fullWidth
                  >
                    Save as template
                  </Button>
                </BlockStack>
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
                        <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                          Create your first export using the form on the left.
                          Save it as a template to re-run with one click.
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

      {saveModalOpen && (
        <Modal
          open
          onClose={() => setSaveModalOpen(false)}
          title="Save as template"
          primaryAction={{
            content: "Save template",
            onAction: handleSaveTemplate,
            disabled: !templateName.trim(),
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setSaveModalOpen(false),
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd" tone="subdued">
                Save the current format and filters as a reusable template.
                One click to re-run anytime.
              </Text>
              <TextField
                label="Template name"
                value={templateName}
                onChange={setTemplateName}
                placeholder="e.g. Monthly active subscribers"
                autoComplete="off"
                autoFocus
              />
              <BlockStack gap="100">
                <Text as="span" variant="bodySm" fontWeight="semibold">
                  Will save:
                </Text>
                <InlineStack gap="100" wrap>
                  <Badge tone={formatBadgeTone(format[0])}>
                    {formatLabel(format[0])}
                  </Badge>
                  {statusFilter.length > 0 ? (
                    statusFilter.map((s) => <Badge key={s}>{s}</Badge>)
                  ) : (
                    <Text as="span" variant="bodySm" tone="subdued">
                      All statuses
                    </Text>
                  )}
                </InlineStack>
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
