import { Link } from "react-router";

export const meta = () => [
  { title: "Terms of Service — SubsExport" },
  { name: "description", content: "Terms of service for using SubsExport." },
];

export default function Terms() {
  return (
    <div style={pageStyle}>
      <Header />
      <main style={mainStyle}>
        <article style={articleStyle}>
          <span style={eyebrowStyle}>LEGAL</span>
          <h1 style={h1Style}>Terms of Service</h1>
          <p style={metaStyle}>Last updated: May 22, 2026</p>

          <p>
            These Terms of Service ("Terms") govern your use of SubsExport
            ("the app", "the service"), provided by Add One Plugins. By installing
            or using the app, you agree to these Terms.
          </p>

          <h2 style={h2Style}>1. Service description</h2>
          <p>
            SubsExport is a Shopify app that lets merchants connect supported
            third-party subscription platforms (ReCharge, Skio, Seal, Loop,
            PayWhirl, Bold, and others) and export subscription data in CSV,
            Excel, or Google Sheets format. The app provides on-demand and
            scheduled exports, search and filtering, retention analytics, and
            related features.
          </p>

          <h2 style={h2Style}>2. Account and eligibility</h2>
          <p>
            You must have an active Shopify store and a valid Shopify Partner
            or merchant account to install the app. You are responsible for
            keeping your Shopify account credentials secure. You agree to use
            the app only for lawful purposes related to your own Shopify
            store.
          </p>

          <h2 style={h2Style}>3. Third-party integrations</h2>
          <p>
            The app integrates with third-party subscription services. You are
            responsible for ensuring that your use of these services complies
            with their respective terms. We do not control or take
            responsibility for the availability, accuracy, or behavior of
            third-party APIs. If a third-party service changes or terminates
            its API, related app features may be affected.
          </p>

          <h2 style={h2Style}>4. Data ownership</h2>
          <p>
            You retain full ownership of all data accessed or processed by the
            app on your behalf. We do not claim ownership of your data and
            will not use it for any purpose other than to provide the service
            to you, as described in our{" "}
            <Link to="/privacy" style={linkStyle}>
              Privacy Policy
            </Link>
            .
          </p>

          <h2 style={h2Style}>5. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the app to process data you do not have legal rights to.</li>
            <li>
              Attempt to reverse-engineer, decompile, or extract source code
              from the app.
            </li>
            <li>
              Use the app in a way that exceeds reasonable usage limits or
              degrades service for other merchants.
            </li>
            <li>Resell, sublicense, or redistribute the app's output
              without prior written permission.
            </li>
            <li>
              Violate Shopify's Acceptable Use Policy or any applicable laws.
            </li>
          </ul>

          <h2 style={h2Style}>6. Service availability</h2>
          <p>
            We aim for high availability but do not guarantee uninterrupted or
            error-free service. The app is provided on an "as-is" and
            "as-available" basis. We may modify, suspend, or discontinue
            features with reasonable notice.
          </p>

          <h2 style={h2Style}>7. Pricing and billing</h2>
          <p>
            During the initial release period, the app is provided free of
            charge. Pricing tiers may be introduced in the future with
            advance notice. Continued use of the app after a pricing change
            constitutes acceptance of the new pricing.
          </p>

          <h2 style={h2Style}>8. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, Add One Plugins and SubsExport
            shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages, including but not limited to
            loss of revenue, data, or profits, arising from your use of or
            inability to use the app.
          </p>

          <h2 style={h2Style}>9. Termination</h2>
          <p>
            You may stop using the app at any time by uninstalling it from
            your Shopify admin. We may suspend or terminate access if you
            violate these Terms. Upon uninstall, your data is deleted in
            accordance with the schedule described in our Privacy Policy.
          </p>

          <h2 style={h2Style}>10. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. The "Last updated"
            date reflects the most recent revision. Material changes will be
            communicated via the app's admin interface. Continued use after a
            change constitutes acceptance of the new Terms.
          </p>

          <h2 style={h2Style}>11. Governing law</h2>
          <p>
            These Terms are governed by the laws of the jurisdiction in which
            Add One Plugins is established, without regard to conflict-of-law
            principles.
          </p>

          <h2 style={h2Style}>12. Contact</h2>
          <p>
            Questions about these Terms:{" "}
            <a href="mailto:support@addoneplugins.com" style={linkStyle}>
              support@addoneplugins.com
            </a>
            .
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
const linkStyle = { color: "#1a1a1a", textDecoration: "underline" };
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
