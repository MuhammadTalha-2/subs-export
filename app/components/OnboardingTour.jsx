import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Modal,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Box,
  Icon,
  Badge,
} from "@shopify/polaris";
import {
  LinkIcon,
  ViewIcon,
  ExportIcon,
  ChartLineIcon,
  CheckCircleIcon,
} from "@shopify/polaris-icons";

const STORAGE_KEY = "subsexport_onboarding_dismissed_v1";

const STEPS = [
  {
    icon: CheckCircleIcon,
    iconBg: "#e8f0fe",
    iconColor: "#1a73e8",
    title: "Welcome to SubsExport",
    body: "Export and schedule subscription data from ReCharge, Skio, Seal, Loop, PayWhirl, and more — all from one dashboard. Let's take a quick 60-second tour.",
  },
  {
    icon: LinkIcon,
    iconBg: "#fef3c7",
    iconColor: "#92400e",
    title: "Connect your subscription app",
    body: "Securely link your subscription platform using an API key or OAuth. We support 5+ subscription apps and unify them into a single data model.",
    chips: ["ReCharge", "Skio", "Seal", "Loop", "PayWhirl"],
  },
  {
    icon: ViewIcon,
    iconBg: "#dcfce7",
    iconColor: "#166534",
    title: "Preview your data",
    body: "See every subscription in one place. Search by email, filter by status, sort any column, and click a row to view all 30 fields of a subscription.",
  },
  {
    icon: ExportIcon,
    iconBg: "#ede9fe",
    iconColor: "#6d28d9",
    title: "Export & automate",
    body: "Export to CSV, Excel, or Google Sheets — one click. Save templates for one-click re-runs. Schedule recurring exports delivered to email or Slack.",
  },
  {
    icon: ChartLineIcon,
    iconBg: "#fce7f3",
    iconColor: "#9d174d",
    title: "Track health & retention",
    body: "Your dashboard surfaces at-risk subscribers (failed payments, overdue charges), cohort retention by month, and growth trends — so you spot churn before it happens.",
  },
];

function StepIllustration({ step }) {
  return (
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: 16,
        background: step.iconBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginInline: "auto",
        marginBottom: 24,
      }}
    >
      <div style={{ transform: "scale(2)", color: step.iconColor }}>
        <Icon source={step.icon} />
      </div>
    </div>
  );
}

function StepDots({ total, current, onJump }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        justifyContent: "center",
        marginBlock: 16,
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onJump(i)}
          aria-label={`Go to step ${i + 1}`}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            background:
              i === current ? "var(--p-color-bg-fill-emphasis)" : "var(--p-color-bg-fill-tertiary)",
            border: "none",
            cursor: "pointer",
            transition: "width 180ms ease, background 180ms ease",
            padding: 0,
          }}
        />
      ))}
    </div>
  );
}

export default function OnboardingTour({ open, onClose }) {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);

  const isLastStep = stepIndex === STEPS.length - 1;
  const isFirstStep = stepIndex === 0;
  const step = STEPS[stepIndex];

  const handleFinish = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    onClose();
    navigate("/app/connections");
  }, [onClose, navigate]);

  const handleSkip = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <Modal
      open
      onClose={handleSkip}
      title="Getting started"
      size="small"
    >
      <Modal.Section>
        <BlockStack gap="400">
          <StepIllustration step={step} />

          <BlockStack gap="200" inlineAlign="center">
            <Text as="h2" variant="headingLg" alignment="center">
              {step.title}
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
              {step.body}
            </Text>
            {step.chips && (
              <Box paddingBlockStart="200">
                <InlineStack gap="150" align="center" wrap>
                  {step.chips.map((chip) => (
                    <Badge key={chip}>{chip}</Badge>
                  ))}
                </InlineStack>
              </Box>
            )}
          </BlockStack>

          <StepDots
            total={STEPS.length}
            current={stepIndex}
            onJump={setStepIndex}
          />

          <InlineStack align="space-between" blockAlign="center">
            <Button variant="plain" onClick={handleSkip}>
              Skip tour
            </Button>
            <InlineStack gap="200">
              {!isFirstStep && (
                <Button onClick={() => setStepIndex((i) => i - 1)}>
                  Back
                </Button>
              )}
              {isLastStep ? (
                <Button variant="primary" onClick={handleFinish}>
                  Connect an app
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => setStepIndex((i) => i + 1)}
                >
                  Next
                </Button>
              )}
            </InlineStack>
          </InlineStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

export function shouldShowOnboarding({ hasConnections, hasExports }) {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return false;
  } catch {
    // ignore
  }
  return !hasConnections && !hasExports;
}

export function resetOnboarding() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
