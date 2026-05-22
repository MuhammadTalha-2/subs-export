import { useState, useEffect } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

const criticalCss = `
  html, body {
    margin: 0;
    background: #f1f1f1;
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
    color: #1a1a1a;
  }
  [class*="VisuallyHidden"],
  [class*="visually-hidden"] {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    margin: -1px !important;
    padding: 0 !important;
    overflow: hidden !important;
    clip: rect(0,0,0,0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  }
  svg {
    max-width: 20px;
    max-height: 20px;
    display: inline-block;
    vertical-align: middle;
  }
  #app-root-loader {
    position: fixed;
    inset: 0;
    background: #f1f1f1;
    z-index: 9999;
    overflow: hidden;
    transition: opacity 200ms ease;
  }
  .skel-wrap {
    max-width: 1120px;
    margin: 0 auto;
    padding: 24px;
  }
  .skel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  .skel-block {
    background: #e3e3e3;
    border-radius: 6px;
    position: relative;
    overflow: hidden;
  }
  .skel-block::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255,255,255,0.6) 50%,
      transparent 100%
    );
    transform: translateX(-100%);
    animation: shimmer 1.4s infinite;
  }
  @keyframes shimmer {
    100% { transform: translateX(100%); }
  }
  .skel-title { width: 200px; height: 28px; }
  .skel-action { width: 90px; height: 32px; border-radius: 8px; }
  .skel-subtitle { width: 280px; height: 14px; margin-top: 8px; }
  .skel-card {
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.04);
  }
  .skel-row { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; }
  .skel-row:last-child { margin-bottom: 0; }
  .skel-avatar { width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0; }
  .skel-text-lg { height: 18px; width: 60%; }
  .skel-text-md { height: 14px; width: 80%; }
  .skel-text-sm { height: 12px; width: 40%; }
  .skel-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 16px;
  }
  .skel-stat { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 0 0 1px rgba(0,0,0,0.04); }
  .skel-stat-bar { display: flex; gap: 16px; align-items: center; }
  .skel-stat-content { flex: 1; }
  .skel-stat-num { height: 28px; width: 50%; margin-top: 8px; }
  .skel-grid-4 { grid-template-columns: repeat(4, 1fr); }
  .skel-grid-2 { grid-template-columns: repeat(2, 1fr); }
  .skel-layout { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; }
  .skel-sidebar > .skel-card { margin-bottom: 16px; }
  .skel-section { margin-bottom: 24px; }
  .skel-section-head {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 12px;
  }
  .skel-section-label { width: 160px; height: 22px; }
  .skel-table { display: flex; flex-direction: column; gap: 12px; padding-top: 8px; }
  .skel-table-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
    gap: 12px;
    align-items: center;
    padding: 8px 0;
    border-top: 1px solid #f1f1f1;
  }
  .skel-table-row:first-child { border-top: 0; }
  .skel-pill { width: 60px; height: 22px; border-radius: 10px; }
  .skel-num { width: 40px; height: 16px; }
  .skel-btn-icon { width: 28px; height: 28px; border-radius: 6px; }
  .skel-coming-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .skel-coming-card {
    background: #fff;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.04);
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .skel-form-field { margin-bottom: 16px; }
  .skel-label { width: 80px; height: 12px; margin-bottom: 6px; }
  .skel-input { width: 100%; height: 36px; border-radius: 6px; }
  .skel-button-full { width: 100%; height: 40px; border-radius: 8px; }
  .skel-badges { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .skel-badge { width: 90px; height: 22px; border-radius: 10px; }
  @media (max-width: 768px) {
    .skel-layout { grid-template-columns: 1fr; }
    .skel-grid-4 { grid-template-columns: repeat(2, 1fr); }
    .skel-table-row { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 640px) {
    .skel-grid { grid-template-columns: 1fr; }
  }

  /* Top navigation progress bar */
  .nav-progress {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(0,0,0,0.05);
    z-index: 100000;
    overflow: hidden;
    pointer-events: none;
  }
  .nav-progress::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 30%;
    height: 100%;
    background: linear-gradient(90deg, transparent, #1a1a1a, transparent);
    animation: nav-progress-slide 1.1s ease-in-out infinite;
  }
  @keyframes nav-progress-slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(450%); }
  }
`;

function Skeleton() {
  return (
    <div id="app-root-loader">
      <div className="skel-wrap">
        <div className="skel-header">
          <div>
            <div className="skel-block skel-title" />
            <div className="skel-block skel-subtitle" />
          </div>
          <div className="skel-block skel-action" />
        </div>

        <div className="skel-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel-stat">
              <div className="skel-stat-bar">
                <div className="skel-block skel-avatar" />
                <div className="skel-stat-content">
                  <div className="skel-block skel-text-sm" />
                  <div className="skel-block skel-stat-num" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="skel-card">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel-row">
              <div className="skel-block skel-avatar" />
              <div style={{ flex: 1 }}>
                <div className="skel-block skel-text-lg" />
                <div className="skel-block skel-text-md" style={{ marginTop: 8 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isEmbeddedApp = location.pathname.startsWith("/app");
  const [ready, setReady] = useState(!isEmbeddedApp);

  useEffect(() => {
    if (!isEmbeddedApp) {
      setReady(true);
      return;
    }
    let cancelled = false;

    function checkStyles() {
      if (cancelled) return;
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      const allLoaded =
        links.length > 0 &&
        Array.from(links).every((l) => l.sheet);
      if (allLoaded) {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!cancelled) setReady(true);
          }),
        );
      } else {
        setTimeout(checkStyles, 50);
      }
    }

    checkStyles();

    const fallback = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 4000);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [isEmbeddedApp]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <style dangerouslySetInnerHTML={{ __html: criticalCss }} />
        <Meta />
        <Links />
      </head>
      <body>
        {isEmbeddedApp && !ready && <Skeleton />}
        <div
          style={
            isEmbeddedApp
              ? {
                  opacity: ready ? 1 : 0,
                  transition: "opacity 200ms ease",
                }
              : undefined
          }
        >
          <Outlet />
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
