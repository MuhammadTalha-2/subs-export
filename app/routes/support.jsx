import { Link } from "react-router";

export const meta = () => [
  { title: "Support — SubsExport" },
  { name: "description", content: "Get help with SubsExport." },
];

const FAQS = [
  {
    q: "Which subscription apps do you support?",
    a: "SubsExport supports ReCharge, Skio, Seal Subscriptions, Loop Subscriptions, PayWhirl, and Bold Subscriptions (V2). We also include a demo data source so you can try the app before connecting a real account.",
  },
  {
    q: "How do I connect my subscription app?",
    a: "Go to Connections inside the SubsExport admin. Click Connect on the app you use, paste your API key or complete the OAuth flow, and you're done. Most integrations take less than a minute.",
  },
  {
    q: "Where are my API keys stored?",
    a: "All third-party API keys and OAuth tokens are encrypted at rest using AES-256-CBC before being saved to our database. They are decrypted only when the app needs to make a request on your behalf.",
  },
  {
    q: "Can I export data on a recurring schedule?",
    a: "Yes. Go to Settings → New Schedule to set up daily, weekly, or monthly automated exports. Exports can be delivered via email or to a Slack channel via incoming webhook.",
  },
  {
    q: "What export formats do you support?",
    a: "CSV, Excel (.xlsx), and Google Sheets. For Google Sheets, you'll need to connect your Google account in Settings first.",
  },
  {
    q: "Does the app modify any of my subscription data?",
    a: "No. SubsExport is strictly read-only. We never create, edit, pause, cancel, or delete subscriptions in your connected platforms.",
  },
  {
    q: "What happens to my data when I uninstall?",
    a: "Shopify sends us a shop/redact webhook 48 hours after uninstall. Within that window, we permanently delete all data associated with your store — API credentials, export history, schedules, and templates.",
  },
  {
    q: "Is the app GDPR compliant?",
    a: "Yes. We implement Shopify's mandatory privacy webhooks (customers/data_request, customers/redact, shop/redact). For more details, see our Privacy Policy.",
  },
];

export default function Support() {
  return (
    <div style={pageStyle}>
      <Header />
      <main style={mainStyle}>
        <div style={containerStyle}>
          <span style={eyebrowStyle}>HELP CENTER</span>
          <h1 style={h1Style}>Support</h1>
          <p style={leadStyle}>
            We're here to help. Browse the FAQ below or reach out directly.
          </p>

          <section style={contactSectionStyle}>
            <div style={contactCardStyle}>
              <h2 style={contactTitleStyle}>Get in touch</h2>
              <p style={contactBodyStyle}>
                Questions, feature requests, or bug reports — we read every
                message.
              </p>
              <a
                href="mailto:support@addoneplugins.com"
                style={contactButtonStyle}
              >
                Email support@addoneplugins.com
              </a>
              <p style={contactFootnoteStyle}>
                Typical response time: within 1 business day.
              </p>
            </div>
          </section>

          <section style={faqSectionStyle}>
            <h2 style={h2Style}>Frequently asked questions</h2>
            <div style={faqListStyle}>
              {FAQS.map((item, i) => (
                <details key={i} style={faqItemStyle}>
                  <summary style={faqQStyle}>{item.q}</summary>
                  <p style={faqAStyle}>{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section style={resourcesSectionStyle}>
            <h2 style={h2Style}>Resources</h2>
            <div style={resourceGridStyle}>
              <Link to="/privacy" style={resourceCardStyle}>
                <h3 style={resourceTitleStyle}>Privacy Policy</h3>
                <p style={resourceBodyStyle}>
                  How we handle your data and customer information.
                </p>
              </Link>
              <Link to="/terms" style={resourceCardStyle}>
                <h3 style={resourceTitleStyle}>Terms of Service</h3>
                <p style={resourceBodyStyle}>
                  The terms that govern your use of SubsExport.
                </p>
              </Link>
            </div>
          </section>
        </div>
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
const containerStyle = { maxWidth: 760, margin: "0 auto" };
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
  margin: "0 0 12px",
};
const leadStyle = {
  fontSize: 17,
  color: "#545454",
  lineHeight: 1.55,
  margin: "0 0 40px",
};
const h2Style = {
  fontSize: 24,
  fontWeight: 700,
  marginTop: 0,
  marginBottom: 16,
  letterSpacing: "-0.01em",
};
const contactSectionStyle = { marginBottom: 48 };
const contactCardStyle = {
  background: "#fff",
  border: "1px solid #ececec",
  borderRadius: 12,
  padding: 32,
};
const contactTitleStyle = {
  fontSize: 20,
  fontWeight: 700,
  margin: "0 0 8px",
};
const contactBodyStyle = {
  fontSize: 15,
  color: "#545454",
  margin: "0 0 20px",
  lineHeight: 1.55,
};
const contactButtonStyle = {
  display: "inline-block",
  padding: "12px 20px",
  background: "#1a1a1a",
  color: "#fff",
  textDecoration: "none",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
};
const contactFootnoteStyle = {
  fontSize: 13,
  color: "#6b7280",
  margin: "16px 0 0",
};
const faqSectionStyle = { marginBottom: 48 };
const faqListStyle = { display: "flex", flexDirection: "column", gap: 8 };
const faqItemStyle = {
  background: "#fff",
  border: "1px solid #ececec",
  borderRadius: 10,
  padding: "16px 20px",
};
const faqQStyle = {
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 15,
  listStyle: "none",
};
const faqAStyle = {
  marginTop: 12,
  fontSize: 14,
  lineHeight: 1.6,
  color: "#545454",
};
const resourcesSectionStyle = { marginBottom: 32 };
const resourceGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};
const resourceCardStyle = {
  display: "block",
  padding: 20,
  background: "#fff",
  border: "1px solid #ececec",
  borderRadius: 10,
  textDecoration: "none",
  color: "#1a1a1a",
  transition: "border-color 120ms ease",
};
const resourceTitleStyle = {
  fontSize: 16,
  fontWeight: 700,
  margin: "0 0 6px",
};
const resourceBodyStyle = {
  fontSize: 13,
  color: "#545454",
  margin: 0,
  lineHeight: 1.5,
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
