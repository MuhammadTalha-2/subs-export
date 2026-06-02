import { useNavigate } from "react-router";
import {
  BlockStack,
  InlineStack,
  Text,
  Button,
  Icon,
  Box,
} from "@shopify/polaris";
import { LockIcon } from "@shopify/polaris-icons";

/**
 * LockedFeature wraps any UI block and, when `locked` is true, blurs the
 * content underneath and overlays an "upgrade required" call-to-action
 * pointing at /app/plans.
 *
 * Use this anywhere a feature should still be VISIBLE to the merchant — so
 * they can see what they're missing — but interactively gated until they
 * upgrade. Examples: cohort analytics on Free, Slack delivery on Growth,
 * scheduled-export form on Free.
 *
 * When `locked` is false, the wrapper is transparent — it renders children
 * straight through so the same JSX works in gated and ungated states.
 *
 * @param {object} props
 * @param {boolean} props.locked - whether to show the upgrade overlay
 * @param {'growth' | 'pro'} [props.requiredPlan] - which plan unlocks this
 * @param {string} props.featureName - short, human-readable feature name
 *   shown in the overlay (e.g. "Cohort retention analytics")
 * @param {string} [props.description] - optional secondary line explaining
 *   what the feature does
 * @param {React.ReactNode} props.children - the gated UI
 */
export function LockedFeature({
  locked,
  requiredPlan = "growth",
  featureName,
  description,
  children,
}) {
  const navigate = useNavigate();

  if (!locked) {
    return children;
  }

  const planTitle = requiredPlan === "pro" ? "Pro" : "Growth";

  return (
    // position:relative anchors the absolute overlay; overflow:hidden clips
    // the blur halo to the rounded card corners. minWidth: 0 prevents the
    // wrapped Card from forcing the parent Layout.Section into an extra-wide
    // intrinsic width.
    <div
      style={{
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Underlay: the real feature UI, blurred and made non-interactive.
          aria-hidden + inert removes the blurred content from the a11y tree
          and from tab order so screen-reader / keyboard users can't reach
          stuff they can't actually use. */}
      <div
        aria-hidden="true"
        inert=""
        style={{
          filter: "blur(4px)",
          pointerEvents: "none",
          userSelect: "none",
          // A subtle desaturation on top of the blur reinforces "this is
          // disabled" without hiding the visual shape of the gated section.
          opacity: 0.6,
        }}
      >
        {children}
      </div>

      {/* Overlay: upgrade prompt centered over the blurred content. The
          semi-transparent background lets the blur peek through so the
          merchant can still see what they're about to unlock. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // rgba white with slight transparency — works against both light
          // Polaris cards and the page background.
          background: "rgba(255, 255, 255, 0.55)",
          backdropFilter: "blur(2px)",
          // Compact horizontal padding so the prompt doesn't get cramped on
          // narrow tiles (e.g. inside the dashboard's 4-column at-risk grid).
          padding: 16,
        }}
      >
        <Box
          background="bg-surface"
          padding="400"
          borderRadius="300"
          shadow="200"
          maxWidth="360px"
        >
          <BlockStack gap="300" inlineAlign="center">
            <InlineStack gap="200" blockAlign="center">
              <Icon source={LockIcon} tone="subdued" />
              <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">
                {planTitle} feature
              </Text>
            </InlineStack>

            <BlockStack gap="100" inlineAlign="center">
              <Text as="h3" variant="headingSm" alignment="center">
                {featureName}
              </Text>
              {description && (
                <Text
                  as="p"
                  variant="bodySm"
                  tone="subdued"
                  alignment="center"
                >
                  {description}
                </Text>
              )}
            </BlockStack>

            <Button
              variant="primary"
              size="medium"
              onClick={() => navigate("/app/plans")}
            >
              Upgrade to {planTitle}
            </Button>
          </BlockStack>
        </Box>
      </div>
    </div>
  );
}
