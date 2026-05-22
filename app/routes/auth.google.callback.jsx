import { ensureShop } from "../utils/shop.server";
import {
  exchangeCodeForTokens,
  saveGoogleTokens,
  getGoogleUserEmail,
} from "../services/google-auth.server";

function htmlResponse(success, detail) {
  const icon = success ? "✓" : "✗";
  const iconColor = success ? "#008060" : "#d72c0d";
  const title = success ? "Google Sheets Connected!" : "Connection Failed";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Google Sheets — SubsExport</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f6f6f7; }
    .card { background: white; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 400px; }
    .icon { font-size: 48px; margin-bottom: 16px; color: ${iconColor}; }
    h1 { font-size: 20px; color: #1a1a1a; margin: 0 0 8px; }
    p { font-size: 14px; color: #616161; margin: 0 0 20px; }
    .btn { background: #1a1a1a; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; cursor: pointer; text-decoration: none; display: inline-block; }
    .btn:hover { background: #333; }
    .hint { margin-top: 12px; font-size: 12px; color: #9e9e9e; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${detail}</p>
    <button class="btn" onclick="window.close()">Close this tab</button>
    <p class="hint">Go back to your Shopify admin and refresh the Settings page.</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const shopDomain = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    console.error("Google OAuth error:", error);
    return htmlResponse(false, error);
  }

  if (!code || !shopDomain) {
    return htmlResponse(false, "Missing parameters from Google.");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    let email = null;
    try {
      email = await getGoogleUserEmail(tokens);
    } catch (e) {
      console.warn("Could not fetch Google email:", e.message);
    }

    const shop = await ensureShop(shopDomain);
    await saveGoogleTokens(shop.id, tokens, email);

    return htmlResponse(true, email ? `Connected as ${email}.` : "Google Sheets connected successfully.");
  } catch (err) {
    console.error("Google OAuth callback error:", err.message);
    return htmlResponse(false, err.message);
  }
};
