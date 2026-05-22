import { Link } from "react-router";

export const meta = () => [
  { title: "Privacy Policy — SubsExport" },
  { name: "description", content: "How SubsExport handles your data." },
];

export default function Privacy() {
  return (
    <div style={pageStyle}>
      <Header />
      <main style={mainStyle}>
        <article style={articleStyle}>
          <span style={eyebrowStyle}>LEGAL</span>
          <h1 style={h1Style}>Privacy Policy</h1>
          <p style={metaStyle}>Last updated: May 22, 2026</p>

          <p>
            SubsExport ("we", "our", "the app") is operated by Add One Plugins. This
            Privacy Policy explains what data we access, how we use it, and how
            we protect it when you install the app on your Shopify store.
          </p>

          <h2 style={h2Style}>What data we access</h2>
          <p>SubsExport requests read-only access to:</p>
          <ul>
            <li>
              <strong>Customers</strong> — name, email, phone, and shipping
              address — only as part of subscription records you choose to
              export.
            </li>
            <li>
              <strong>Products and orders</strong> — to identify subscription
              line items, SKUs, and billing intervals.
            </li>
            <li>
              <strong>Subscription data</strong> from third-party subscription
              apps you connect (ReCharge, Skio, Seal, Loop, PayWhirl, Bold) via
              the API keys or OAuth tokens you provide.
            </li>
          </ul>

          <p>
            We do <strong>not</strong> access payment card data, customer
            passwords, or any data unrelated to subscriptions.
          </p>

          <h2 style={h2Style}>How we use your data</h2>
          <ul>
            <li>
              To display your subscription data inside the SubsExport admin so
              you can preview, filter, and search it.
            </li>
            <li>
              To generate exports (CSV, Excel, Google Sheets) when you
              explicitly initiate them.
            </li>
            <li>
              To deliver scheduled exports to the email address or Slack channel
              you configure.
            </li>
            <li>
              To compute aggregate analytics (retention, churn, growth metrics)
              shown on your dashboard.
            </li>
          </ul>

          <p>
            We do <strong>not</strong> sell, rent, or share your data with third
            parties for marketing or advertising purposes. We never train AI
            models on your data.
          </p>

          <h2 style={h2Style}>How we store and protect your data</h2>
          <ul>
            <li>
              All third-party API credentials (ReCharge, Skio, etc.) and OAuth
              tokens are encrypted at rest using AES-256-CBC before storage.
            </li>
            <li>
              All data in transit uses HTTPS / TLS 1.2 or higher.
            </li>
            <li>
              Generated export files are stored on our server only as long as
              needed for download or scheduled delivery, and are not shared
              outside your account.
            </li>
            <li>
              We do not store your customers' payment card information.
            </li>
          </ul>

          <h2 style={h2Style}>Data retention and deletion</h2>
          <ul>
            <li>
              <strong>While installed:</strong> we retain subscription metadata
              (export history, scheduled exports, templates) to provide the
              service.
            </li>
            <li>
              <strong>When you uninstall:</strong> Shopify sends us an
              uninstall webhook. Within 48 hours we receive a
              <code> shop/redact </code>
              webhook from Shopify, and we permanently delete all data
              associated with your shop.
            </li>
            <li>
              <strong>Customer data requests:</strong> if one of your customers
              requests their data, Shopify forwards us a
              <code> customers/data_request </code>
              webhook. We will export the requested customer's subscription
              records and provide them to you to fulfill the request.
            </li>
            <li>
              <strong>Customer redaction:</strong> when Shopify sends a
              <code> customers/redact </code>
              webhook, we remove that customer's identifiable data from our
              systems.
            </li>
          </ul>

          <h2 style={h2Style}>GDPR and CCPA</h2>
          <p>
            We comply with the General Data Protection Regulation (GDPR) and
            California Consumer Privacy Act (CCPA). EU and California residents
            have the right to access, correct, port, and delete their personal
            data. Requests can be initiated through the merchant whose store
            contains the data.
          </p>

          <h2 style={h2Style}>Sub-processors</h2>
          <p>
            We use the following third-party services to operate SubsExport:
          </p>
          <ul>
            <li>
              <strong>Neon</strong> — PostgreSQL database hosting (data
              encrypted at rest).
            </li>
            <li>
              <strong>Resend</strong> — transactional email delivery for
              scheduled exports.
            </li>
            <li>
              <strong>Google Cloud Platform</strong> — Google Sheets API
              integration (only when you connect Google Sheets).
            </li>
          </ul>

          <h2 style={h2Style}>Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. The "Last
            updated" date at the top reflects the most recent revision.
            Material changes will be communicated via the app's admin
            interface.
          </p>

          <h2 style={h2Style}>Contact</h2>
          <p>
            Questions or data-access requests:{" "}
            <a href="mailto:support@addoneplugins.com">support@addoneplugins.com</a>.
          </p>
        </article>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header style={headerStyle}>
      <div style={headerInnerStyle}>
        <Link to="/" style={logoLinkStyle}>
          <span style={logoMarkStyle}>S</span>
          <span>SubsExport</span>
        </Link>
        <nav style={navStyle}>
          <Link to="/privacy" style={navLinkStyle}>Privacy</Link>
          <Link to="/terms" style={navLinkStyle}>Terms</Link>
          <Link to="/support" style={navLinkStyle}>Support</Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer style={footerStyle}>
      <div style={footerInnerStyle}>
        <p style={copyrightStyle}>
          © {new Date().getFullYear()} Add One Plugins. Built for Shopify merchants.
        </p>
        <nav style={footerNavStyle}>
          <Link to="/privacy" style={footerLinkStyle}>Privacy Policy</Link>
          <Link to="/terms" style={footerLinkStyle}>Terms of Service</Link>
          <Link to="/support" style={footerLinkStyle}>Support</Link>
        </nav>
      </div>
    </footer>
  );
}

const pageStyle = {
  minHeight: "100vh",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
  color: "#1a1a1a",
  background: "#fafafa",
  display: "flex",
  flexDirection: "column",
};
const headerStyle = { borderBottom: "1px solid #ececec", background: "#fff" };
const headerInnerStyle = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "16px 32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};
const logoLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  fontWeight: 700,
  fontSize: 18,
  color: "#1a1a1a",
  textDecoration: "none",
};
const logoMarkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 7,
  background: "#1a1a1a",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14,
};
const navStyle = { display: "inline-flex", gap: 24 };
const navLinkStyle = { color: "#545454", textDecoration: "none", fontSize: 14 };
const mainStyle = { flex: 1, padding: "64px 32px" };
const articleStyle = {
  maxWidth: 720,
  margin: "0 auto",
  lineHeight: 1.65,
  fontSize: 15,
  color: "#1a1a1a",
};
const eyebrowStyle = {
  display: "inline-block",
  padding: "4px 10px",
  background: "#eef2ff",
  color: "#4338ca",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  borderRadius: 999,
  marginBottom: 16,
};
const h1Style = {
  fontSize: 40,
  fontWeight: 800,
  letterSpacing: "-0.02em",
  margin: "0 0 8px",
};
const metaStyle = { color: "#6b7280", fontSize: 14, margin: "0 0 32px" };
const h2Style = {
  fontSize: 22,
  fontWeight: 700,
  marginTop: 40,
  marginBottom: 12,
  letterSpacing: "-0.01em",
};
const footerStyle = {
  marginTop: "auto",
  borderTop: "1px solid #ececec",
  background: "#fff",
  padding: 32,
};
const footerInnerStyle = {
  maxWidth: 1100,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 16,
};
const copyrightStyle = { fontSize: 12, color: "#6b7280", margin: 0 };
const footerNavStyle = { display: "inline-flex", gap: 24 };
const footerLinkStyle = { color: "#545454", textDecoration: "none", fontSize: 13 };
