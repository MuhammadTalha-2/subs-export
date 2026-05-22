const AUTHORIZE_URL = "https://apps.boldapps.net/accounts/dashboard/authorize";
const TOKEN_URL = "https://api.boldcommerce.com/auth/oauth2/token";
const API_BASE = "https://api.boldcommerce.com";
const SUBSCRIPTIONS_PATH = "/subscriptions/v1/shops";

const PAGE_SIZE = 100;
const RATE_LIMIT_DELAY = 150;
const MAX_RETRIES = 3;

const SCOPES = [
  "read_subscriptions",
  "read_shops",
  "read_customers",
];

function clientCreds() {
  const clientId = process.env.BOLD_CLIENT_ID;
  const clientSecret = process.env.BOLD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Bold OAuth is not configured. Set BOLD_CLIENT_ID and BOLD_CLIENT_SECRET environment variables.",
    );
  }
  return { clientId, clientSecret };
}

function redirectUri() {
  const appUrl = process.env.SHOPIFY_APP_URL;
  if (!appUrl) {
    throw new Error("SHOPIFY_APP_URL is not set");
  }
  return `${appUrl}/auth/bold/callback`;
}

export function getBoldAuthUrl(state) {
  const { clientId } = clientCreds();
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SCOPES.join(" "),
    redirect_uri: redirectUri(),
    state: state || "",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeBoldCode(code) {
  const { clientId, clientSecret } = clientCreds();

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri(),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bold token exchange failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Bold token response missing access_token");
  }
  return data;
}

function authHeader(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function boldRequest(path, accessToken, retries = 0) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeader(accessToken),
  });

  if (res.status === 401 || res.status === 403) {
    let body = "";
    try {
      body = await res.text();
    } catch {
      // ignore
    }
    throw new Error(
      `Bold authorization failed. The access token may have been revoked. (HTTP ${res.status}) ${body.slice(0, 200)}`,
    );
  }

  if (res.status === 429) {
    if (retries >= MAX_RETRIES) {
      throw new Error("Bold rate limit exceeded after retries");
    }
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 * Math.pow(2, retries)),
    );
    return boldRequest(path, accessToken, retries + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bold API error ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json();
}

export async function discoverBoldShop(accessToken) {
  const endpoints = [
    "/shops/v1/shops",
    "/auth/v1/shops",
    "/shops/v1/me",
  ];

  for (const endpoint of endpoints) {
    try {
      const data = await boldRequest(endpoint, accessToken);
      const shops = data?.shops || data?.data || (Array.isArray(data) ? data : null);
      const shop = Array.isArray(shops) ? shops[0] : shops || data;
      const identifier =
        shop?.identifier ||
        shop?.shop_identifier ||
        shop?.id ||
        shop?.shop_id ||
        shop?.uuid;
      if (identifier) {
        return {
          identifier: String(identifier),
          name: shop?.name || shop?.domain || null,
        };
      }
    } catch {
      // try next endpoint
    }
  }

  return null;
}

export async function verifyBoldConnection(creds) {
  if (!creds?.accessToken || !creds?.shopIdentifier) {
    return { valid: false, error: "Missing access token or shop identifier" };
  }
  try {
    await boldRequest(
      `${SUBSCRIPTIONS_PATH}/${creds.shopIdentifier}/subscriptions?limit=1`,
      creds.accessToken,
    );
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export async function fetchBoldSubscriptions(creds, { limit } = {}) {
  if (!creds?.accessToken || !creds?.shopIdentifier) {
    throw new Error("Bold credentials missing access token or shop identifier");
  }

  const results = [];
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    const pageSize = limit
      ? Math.min(PAGE_SIZE, limit - results.length)
      : PAGE_SIZE;
    if (pageSize <= 0) break;

    const params = new URLSearchParams();
    params.set("limit", String(pageSize));
    if (cursor) params.set("cursor", cursor);

    const data = await boldRequest(
      `${SUBSCRIPTIONS_PATH}/${creds.shopIdentifier}/subscriptions?${params.toString()}`,
      creds.accessToken,
    );

    const subscriptions = data?.subscriptions || data?.data || [];
    if (subscriptions.length === 0) break;

    results.push(...subscriptions);

    if (limit && results.length >= limit) {
      return results.slice(0, limit);
    }

    const next = data?.pagination?.next || data?.next || data?.next_cursor;
    if (!next || subscriptions.length < pageSize) {
      hasMore = false;
    } else {
      cursor = next;
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  return results;
}

function normalizeStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "active";
  if (s === "paused") return "paused";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "expired") return "expired";
  if (s === "failed" || s === "past_due") return "failed";
  return s || "active";
}

function formatDate(value) {
  if (!value) return null;
  try {
    const d = typeof value === "number" ? new Date(value * 1000) : new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

function parseRrule(rruleStr) {
  if (!rruleStr || typeof rruleStr !== "string") {
    return { count: 1, unit: "month" };
  }
  const freq = (rruleStr.match(/FREQ=([A-Z]+)/i) || [])[1];
  const interval = parseInt((rruleStr.match(/INTERVAL=(\d+)/i) || [])[1], 10) || 1;
  const unitMap = {
    DAILY: "day",
    WEEKLY: "week",
    MONTHLY: "month",
    YEARLY: "year",
  };
  return {
    count: interval,
    unit: unitMap[String(freq || "").toUpperCase()] || "month",
  };
}

function formatInterval(count, unit) {
  const num = parseInt(count, 10) || 1;
  const u = String(unit || "month").toLowerCase();
  return `Every ${num} ${u}${num > 1 ? "s" : ""}`;
}

export function mapBoldToUnified(sub) {
  const customer = sub.customer || sub.customer_data || {};
  const lineItems = Array.isArray(sub.line_items) ? sub.line_items : [];
  const firstLine = lineItems[0] || {};
  const shipping = sub.shipping_address || sub.shippingAddress || {};
  const discountCode = sub.discount_code || sub.discount?.code || null;

  const billing = parseRrule(sub.payment_rrule || sub.order_rrule);

  return {
    subscription_id: String(sub.id || sub.subscription_id || sub.external_id || ""),
    customer_id: String(
      customer.id || customer.external_id || sub.customer_id || "",
    ),
    customer_email: customer.email || sub.customer_email || "",
    customer_first_name:
      customer.first_name || shipping.first_name || "",
    customer_last_name: customer.last_name || shipping.last_name || "",
    customer_phone: customer.phone || shipping.phone || "",
    customer_tag: "",
    subscription_status: normalizeStatus(sub.subscription_status || sub.status),
    product_title:
      firstLine.product_title || firstLine.title || firstLine.name || "",
    variant_title: firstLine.variant_title || firstLine.variant || "",
    sku: firstLine.sku || "",
    quantity: parseInt(firstLine.quantity, 10) || 0,
    price_per_cycle:
      parseFloat(firstLine.price) ||
      parseFloat(firstLine.unit_price) ||
      parseFloat(firstLine.amount) ||
      0,
    currency: sub.currency || firstLine.currency || "USD",
    billing_interval: formatInterval(billing.count, billing.unit),
    billing_interval_unit: billing.unit,
    next_charge_date: formatDate(
      sub.next_payment_datetime ||
        sub.next_order_datetime ||
        sub.next_processing_datetime,
    ),
    last_charge_date: formatDate(sub.last_payment_datetime),
    subscription_start_date: formatDate(sub.created_at || sub.start_date),
    cancellation_date: formatDate(sub.cancelled_at || sub.canceled_at),
    cancellation_reason: sub.cancellation_reason || null,
    total_charges_to_date: null,
    total_revenue_to_date: null,
    discount_code: discountCode,
    discount_value: sub.discount?.value
      ? parseFloat(sub.discount.value) || null
      : null,
    shipping_address_1: shipping.address1 || shipping.address_1 || "",
    shipping_city: shipping.city || "",
    shipping_province: shipping.province || shipping.state || "",
    shipping_country: shipping.country_code || shipping.country || "",
    shipping_zip: shipping.zip || shipping.postal_code || "",
    _source: "bold",
  };
}
