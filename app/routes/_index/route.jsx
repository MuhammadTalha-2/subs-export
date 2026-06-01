import { useEffect } from "react";
import { redirect, Form, useLoaderData, Link } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const meta = () => [
  { title: "SubsExport — Export subscription data from any Shopify subscription app" },
  {
    name: "description",
    content:
      "Unified exports from ReCharge, Skio, Seal, Loop, PayWhirl and more. CSV, Excel, or Google Sheets — on demand or on a schedule.",
  },
];

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  // Any of these query params signal the request came from Shopify's embed,
  // App Store install flow, or post-OAuth handoff. Send the merchant straight
  // to the embedded app rather than the public marketing page.
  const embedSignals = ["shop", "host", "embedded", "id_token", "session"];
  const isShopifyContext = embedSignals.some((key) =>
    url.searchParams.get(key),
  );

  if (isShopifyContext) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

const FEATURES = [
  {
    title: "5+ subscription apps in one place",
    body: "Connect ReCharge, Skio, Seal Subscriptions, Loop, PayWhirl and more. We normalize everything into a single 30-field schema you can trust.",
  },
  {
    title: "Export to CSV, Excel, or Google Sheets",
    body: "One-click exports in three formats. Push directly to your Google Drive or download locally. Save reusable templates for recurring reports.",
  },
  {
    title: "Schedule + email or Slack delivery",
    body: "Daily, weekly, or monthly automated exports delivered to your inbox or a Slack channel. Set it once and let your data flow.",
  },
  {
    title: "Track health & retention",
    body: "Surface failed payments, paused subscribers, cohort retention, and 30-day growth - so you spot churn before it happens.",
  },
  {
    title: "Search, sort, drill down",
    body: "Find any subscriber by email, product, or SKU. Sort any column. Click any row for full detail. Built for ops teams, not engineers.",
  },
  {
    title: "Secure & compliant",
    body: "API keys encrypted at rest with AES-256. GDPR-compliant data handling. Read-only access - we never modify your subscriptions.",
  },
];

export default function App() {
  const { showForm } = useLoaderData();

  // If this marketing page is ever rendered inside an iframe (only Shopify's
  // admin embeds us), bounce to /app so the merchant lands on the dashboard
  // instead of seeing the public landing page inside the admin shell.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isFramed = window.self !== window.top;
    if (isFramed) {
      const params = new URLSearchParams(window.location.search);
      window.location.replace(`/app${params.toString() ? `?${params}` : ""}`);
    }
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>S</span>
            <span>SubsExport</span>
          </div>
          <nav className={styles.nav}>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/support">Support</Link>
          </nav>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>SUBSCRIPTION DATA, UNIFIED</span>
          <h1 className={styles.heading}>
            Export subscription data from every Shopify subscription app
          </h1>
          <p className={styles.subhead}>
            ReCharge, Skio, Seal, Loop, PayWhirl — all in one dashboard.
            Export to CSV, Excel, or Google Sheets, on demand or on a schedule.
          </p>

          {showForm && (
            <Form className={styles.form} method="post" action="/auth/login">
              <label className={styles.label} htmlFor="shop">
                <span className={styles.labelText}>Sign in with your Shopify store</span>
              </label>
              <div className={styles.formRow}>
                <input
                  id="shop"
                  className={styles.input}
                  type="text"
                  name="shop"
                  placeholder="my-shop.myshopify.com"
                  autoComplete="off"
                />
                <button className={styles.button} type="submit">
                  Continue
                </button>
              </div>
              <span className={styles.formHint}>
                e.g. <code>my-shop-domain.myshopify.com</code>
              </span>
            </Form>
          )}
        </div>
      </section>

      <section className={styles.features}>
        <div className={styles.featuresInner}>
          <h2 className={styles.sectionHeading}>Built for subscription ops teams</h2>
          <div className={styles.featureGrid}>
            {FEATURES.map((feature) => (
              <div key={feature.title} className={styles.featureCard}>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureBody}>{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <span className={styles.logoMark}>S</span>
            <span>SubsExport</span>
          </div>
          <nav className={styles.footerNav}>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/support">Support</Link>
          </nav>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} Add One Plugins. Built for Shopify merchants.
          </p>
        </div>
      </footer>
    </div>
  );
}
