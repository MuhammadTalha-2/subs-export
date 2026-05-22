import { useState, useCallback, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Select,
  TextField,
  ChoiceList,
  DataTable,
  Divider,
  Box,
  Icon,
  Tooltip,
  InlineGrid,
} from "@shopify/polaris";
import {
  DeleteIcon,
  ClockIcon,
  LinkIcon,
  EmailIcon,
  CalendarIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  CheckCircleIcon,
} from "@shopify/polaris-icons";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../utils/shop.server";
import db from "../db.server";
import { computeFirstRun } from "../services/scheduler.server";
import { STATUS_VALUES } from "../utils/unified-schema";
import { getGoogleAuthStatus, disconnectGoogle } from "../services/google-auth.server";

const DAYS_OF_WEEK = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  label: `${i === 0 ? "12" : i > 12 ? i - 12 : i}:00 ${i < 12 ? "AM" : "PM"}`,
  value: String(i),
}));

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  const schedules = await db.scheduledExport.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });

  const googleAuth = await getGoogleAuthStatus(shop.id);

  const url = new URL(request.url);
  const googleConnected = url.searchParams.get("google_connected");
  const googleError = url.searchParams.get("google_error");

  return {
    schedules: schedules.map((s) => ({
      id: s.id,
      frequency: s.frequency,
      dayOfWeek: s.dayOfWeek,
      hour: s.hour,
      format: s.format,
      email: s.email,
      deliveryMethod: s.deliveryMethod,
      isActive: s.isActive,
      lastRunAt: s.lastRunAt,
      nextRunAt: s.nextRunAt,
      filters: s.filtersJson,
    })),
    googleAuth,
    googleConnected: googleConnected === "true",
    googleError: googleError || null,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create_schedule") {
    const frequency = formData.get("frequency");
    const dayOfWeek = formData.get("dayOfWeek");
    const hour = parseInt(formData.get("hour"), 10);
    const format = formData.get("format") || "csv";
    const email = formData.get("email");
    const statusFilter = formData.getAll("status");

    if (!email || !email.includes("@")) {
      return { error: "A valid email address is required." };
    }

    const filters = {};
    if (statusFilter.length > 0) filters.status = statusFilter;

    const nextRunAt = computeFirstRun(
      frequency,
      dayOfWeek ? parseInt(dayOfWeek, 10) : null,
      hour,
    );

    await db.scheduledExport.create({
      data: {
        shopId: shop.id,
        frequency,
        dayOfWeek: frequency === "weekly" ? parseInt(dayOfWeek, 10) : null,
        hour,
        timezone: "UTC",
        deliveryMethod: "email",
        email: email.trim(),
        format,
        filtersJson: Object.keys(filters).length > 0 ? filters : undefined,
        nextRunAt,
      },
    });

    return { success: "Scheduled export created." };
  }

  if (intent === "toggle_schedule") {
    const scheduleId = formData.get("scheduleId");
    const schedule = await db.scheduledExport.findFirst({
      where: { id: scheduleId, shopId: shop.id },
    });
    if (!schedule) return { error: "Schedule not found." };

    await db.scheduledExport.update({
      where: { id: scheduleId },
      data: { isActive: !schedule.isActive },
    });

    return { success: schedule.isActive ? "Schedule paused." : "Schedule activated." };
  }

  if (intent === "delete_schedule") {
    const scheduleId = formData.get("scheduleId");
    await db.scheduledExport.deleteMany({
      where: { id: scheduleId, shopId: shop.id },
    });
    return { success: "Schedule deleted." };
  }

  if (intent === "disconnect_google") {
    await disconnectGoogle(shop.id);
    return { success: "Google Sheets disconnected." };
  }

  return { error: "Unknown action." };
};

function formatScheduleLabel(s) {
  const dayName = DAYS_OF_WEEK.find((d) => d.value === String(s.dayOfWeek))?.label;
  const hourLabel = HOURS.find((h) => h.value === String(s.hour))?.label;
  if (s.frequency === "daily") return `Daily at ${hourLabel} UTC`;
  if (s.frequency === "weekly") return `Weekly on ${dayName} at ${hourLabel} UTC`;
  if (s.frequency === "monthly") return `Monthly (1st) at ${hourLabel} UTC`;
  return s.frequency;
}

function formatNextRun(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const diff = date.getTime() - Date.now();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (diff < 0) return "Overdue";
  if (hours < 1) return "in <1h";
  if (hours < 24) return `in ${hours}h`;
  if (days < 7) return `in ${days}d`;
  return date.toLocaleDateString();
}

export default function SettingsPage() {
  const { schedules, googleAuth, googleConnected: justConnected, googleError } = useLoaderData();
  const fetcher = useFetcher();
  const result = fetcher.data;
  const isSubmitting = fetcher.state !== "idle";

  useEffect(() => {
    if (result?.success) {
      shopify.toast.show(result.success);
    } else if (result?.error) {
      shopify.toast.show(result.error, { isError: true });
    }
  }, [result]);

  useEffect(() => {
    if (justConnected) {
      shopify.toast.show("Google Sheets connected successfully!");
    } else if (googleError) {
      shopify.toast.show(`Google connection failed: ${googleError}`, { isError: true });
    }
  }, [justConnected, googleError]);

  const [frequency, setFrequency] = useState("daily");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [hour, setHour] = useState("8");
  const [format, setFormat] = useState("csv");
  const [email, setEmail] = useState("");
  const [statusFilter, setStatusFilter] = useState([]);
  const [activeAction, setActiveAction] = useState(null);

  useEffect(() => {
    if (!isSubmitting) setActiveAction(null);
  }, [isSubmitting]);

  const handleCreateSchedule = useCallback(() => {
    setActiveAction("create");
    const formData = new FormData();
    formData.set("intent", "create_schedule");
    formData.set("frequency", frequency);
    formData.set("dayOfWeek", dayOfWeek);
    formData.set("hour", hour);
    formData.set("format", format);
    formData.set("email", email);
    statusFilter.forEach((s) => formData.append("status", s));
    fetcher.submit(formData, { method: "POST" });
  }, [fetcher, frequency, dayOfWeek, hour, format, email, statusFilter]);

  const handleToggle = useCallback(
    (scheduleId) => {
      setActiveAction(`toggle:${scheduleId}`);
      const formData = new FormData();
      formData.set("intent", "toggle_schedule");
      formData.set("scheduleId", scheduleId);
      fetcher.submit(formData, { method: "POST" });
    },
    [fetcher],
  );

  const handleDelete = useCallback(
    (scheduleId) => {
      setActiveAction(`delete:${scheduleId}`);
      const formData = new FormData();
      formData.set("intent", "delete_schedule");
      formData.set("scheduleId", scheduleId);
      fetcher.submit(formData, { method: "POST" });
    },
    [fetcher],
  );

  const handleDisconnectGoogle = useCallback(() => {
    setActiveAction("google");
    const formData = new FormData();
    formData.set("intent", "disconnect_google");
    fetcher.submit(formData, { method: "POST" });
  }, [fetcher]);

  const handleConnectGoogle = useCallback(async () => {
    try {
      const res = await fetch("/auth/google");
      const data = await res.json();
      if (data.authUrl) {
        window.open(data.authUrl, "_blank");
      }
    } catch (err) {
      console.error("Failed to get Google auth URL:", err);
    }
  }, []);

  const activeSchedules = schedules.filter((s) => s.isActive).length;
  const isCreating = isSubmitting && activeAction === "create";

  const scheduleRows = schedules.map((s) => [
    <BlockStack key={`schedule-${s.id}`} gap="050">
      <Text as="span" variant="bodyMd" fontWeight="medium">
        {formatScheduleLabel(s)}
      </Text>
      <Text as="span" variant="bodySm" tone="subdued">
        {s.email || "No email"}
      </Text>
    </BlockStack>,
    <Badge key={`fmt-${s.id}`} tone={s.format === "csv" ? "info" : "success"}>
      {s.format.toUpperCase()}
    </Badge>,
    <Badge key={`status-${s.id}`} tone={s.isActive ? "success" : undefined}>
      {s.isActive ? "Active" : "Paused"}
    </Badge>,
    <BlockStack key={`next-${s.id}`} gap="050">
      <Text as="span" variant="bodyMd" fontWeight="medium">
        {formatNextRun(s.nextRunAt)}
      </Text>
      <Text as="span" variant="bodySm" tone="subdued">
        {s.nextRunAt ? new Date(s.nextRunAt).toLocaleDateString() : "—"}
      </Text>
    </BlockStack>,
    <InlineStack key={`actions-${s.id}`} gap="100" align="end" wrap={false}>
      <Tooltip content={s.isActive ? "Pause schedule" : "Resume schedule"}>
        <Button
          icon={s.isActive ? PauseCircleIcon : PlayCircleIcon}
          size="slim"
          variant="tertiary"
          onClick={() => handleToggle(s.id)}
          loading={isSubmitting && activeAction === `toggle:${s.id}`}
          accessibilityLabel={s.isActive ? "Pause" : "Resume"}
        />
      </Tooltip>
      <Tooltip content="Delete schedule">
        <Button
          icon={DeleteIcon}
          tone="critical"
          size="slim"
          variant="tertiary"
          onClick={() => handleDelete(s.id)}
          loading={isSubmitting && activeAction === `delete:${s.id}`}
          accessibilityLabel="Delete"
        />
      </Tooltip>
    </InlineStack>,
  ]);

  return (
    <Page>
      <ui-title-bar title="Settings" />
      <BlockStack gap="500">

        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">
            Integrations
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Connect external services to extend export capabilities
          </Text>
        </BlockStack>

        <Card>
          <InlineStack gap="400" blockAlign="center" align="space-between" wrap={false}>
            <InlineStack gap="400" blockAlign="center" wrap={false}>
              <Box
                background={googleAuth.connected ? "bg-surface-success" : "bg-surface-secondary"}
                padding="300"
                borderRadius="200"
              >
                <Icon
                  source={googleAuth.connected ? CheckCircleIcon : LinkIcon}
                  tone={googleAuth.connected ? "success" : "subdued"}
                />
              </Box>
              <BlockStack gap="100">
                <InlineStack gap="200" blockAlign="center" align="start" wrap={false}>
                  <Text as="span" variant="headingSm" fontWeight="semibold">
                    Google Sheets
                  </Text>
                  <Badge tone={googleAuth.connected ? "success" : undefined}>
                    {googleAuth.connected ? "Connected" : "Not Connected"}
                  </Badge>
                </InlineStack>
                <Text as="span" variant="bodySm" tone="subdued">
                  {googleAuth.connected
                    ? `Connected as ${googleAuth.email || "Google account"} — exports push directly to Drive`
                    : "Push exports directly to your Google Drive as spreadsheets"}
                </Text>
              </BlockStack>
            </InlineStack>

            {googleAuth.connected ? (
              <Button
                icon={DeleteIcon}
                tone="critical"
                variant="tertiary"
                onClick={handleDisconnectGoogle}
                loading={isSubmitting && activeAction === "google"}
              >
                Disconnect
              </Button>
            ) : (
              <Button
                icon={LinkIcon}
                variant="primary"
                onClick={handleConnectGoogle}
              >
                Connect Google
              </Button>
            )}
          </InlineStack>
        </Card>

        <Box paddingBlockStart="200">
          <Divider />
        </Box>

        <InlineStack align="space-between" blockAlign="start">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">
              Scheduled Exports
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Automatically export and email your subscription data on a recurring schedule
            </Text>
          </BlockStack>
          {schedules.length > 0 && (
            <InlineStack gap="200">
              <Badge tone="success">{activeSchedules} active</Badge>
              <Badge>{schedules.length} total</Badge>
            </InlineStack>
          )}
        </InlineStack>

        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">
                    New Schedule
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Set up an automated export
                  </Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="300">
                  <Select
                    label="Frequency"
                    options={[
                      { label: "Daily", value: "daily" },
                      { label: "Weekly", value: "weekly" },
                      { label: "Monthly (1st of month)", value: "monthly" },
                    ]}
                    value={frequency}
                    onChange={setFrequency}
                  />

                  {frequency === "weekly" && (
                    <Select
                      label="Day of week"
                      options={DAYS_OF_WEEK}
                      value={dayOfWeek}
                      onChange={setDayOfWeek}
                    />
                  )}

                  <Select
                    label="Time (UTC)"
                    options={HOURS}
                    value={hour}
                    onChange={setHour}
                  />

                  <Select
                    label="Format"
                    options={[
                      { label: "CSV", value: "csv" },
                      { label: "Excel (.xlsx)", value: "xlsx" },
                    ]}
                    value={format}
                    onChange={setFormat}
                  />

                  <TextField
                    label="Delivery email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                    autoComplete="email"
                    prefix={<Icon source={EmailIcon} tone="subdued" />}
                  />
                </BlockStack>

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
                    title="Filter by status"
                    titleHidden
                    allowMultiple
                    choices={STATUS_VALUES.map((s) => ({
                      label: s.charAt(0).toUpperCase() + s.slice(1),
                      value: s,
                    }))}
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
                  icon={CalendarIcon}
                  onClick={handleCreateSchedule}
                  loading={isCreating}
                  fullWidth
                  size="large"
                  disabled={!email}
                >
                  {isCreating ? "Creating..." : "Create Schedule"}
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text as="h3" variant="headingSm">
                      Active Schedules
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Manage your recurring exports
                    </Text>
                  </BlockStack>
                </InlineStack>

                <Divider />

                {schedules.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text"]}
                    headings={["Schedule", "Format", "Status", "Next Run", ""]}
                    rows={scheduleRows}
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
                        <Icon source={CalendarIcon} tone="subdued" />
                      </Box>
                      <BlockStack gap="100" inlineAlign="center">
                        <Text as="p" variant="headingSm">
                          No schedules yet
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                          Create your first schedule to automatically export and email subscription data
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
