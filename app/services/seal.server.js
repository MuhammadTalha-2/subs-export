const BASE_URL = "https://app.sealsubscriptions.com/shopify/merchant/api";
const PAGE_SIZE = 50;
const RATE_LIMIT_DELAY = 600;
const MAX_RETRIES = 3;

function headers(apiKey) {
  return {
    "X-Seal-Token": apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function sealRequest(endpoint, apiKey, retries = 0) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: headers(apiKey),
  });

  if (res.status === 429) {
    if (retries >= MAX_RETRIES) {
      throw new Error("Seal rate limit exceeded after retries");
    }
    const delay = 1000 * Math.pow(2, retries);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return sealRequest(endpoint, apiKey, retries + 1);
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid Seal API token");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Seal API error ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json();
}

export async function verifySealApiKey(apiKey) {
  try {
    await sealRequest("/subscriptions?page=1", apiKey);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export async function fetchSealSubscriptions(apiKey, { limit } = {}) {
  const results = [];
  let page = 1;

  while (true) {
    const endpoint = `/subscriptions?page=${page}&with-items=true&with-billing-attempts=true`;
    const data = await sealRequest(endpoint, apiKey);

    const subscriptions = Array.isArray(data?.payload?.subscriptions)
      ? data.payload.subscriptions
      : Array.isArray(data?.subscriptions)
        ? data.subscriptions
        : Array.isArray(data)
          ? data
          : [];

    if (subscriptions.length === 0) break;

    results.push(...subscriptions);

    if (limit && results.length >= limit) {
      return results.slice(0, limit);
    }

    if (subscriptions.length < PAGE_SIZE) break;

    page += 1;
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
  }

  return results;
}

function normalizeStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "active";
  if (s === "paused") return "paused";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "expired") return "expired";
  if (s === "failed") return "failed";
  return s || "active";
}

function formatDate(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

function formatInterval(value, unit) {
  const num = parseInt(value, 10) || 1;
  const u = String(unit || "month").toLowerCase();
  return `Every ${num} ${u}${num > 1 ? "s" : ""}`;
}

function lastBillingAttemptDate(attempts) {
  if (!Array.isArray(attempts) || attempts.length === 0) return null;
  const successful = attempts
    .filter((a) => {
      const s = String(a.status || "").toLowerCase();
      return s === "success" || s === "succeeded" || s === "paid";
    })
    .map((a) => new Date(a.created_at || a.attempted_at || a.processed_at || 0).getTime())
    .filter((t) => !isNaN(t) && t > 0);
  if (successful.length === 0) return null;
  return formatDate(new Date(Math.max(...successful)));
}

function totalRevenueFromAttempts(attempts) {
  if (!Array.isArray(attempts) || attempts.length === 0) return null;
  const total = attempts.reduce((sum, a) => {
    const s = String(a.status || "").toLowerCase();
    if (s !== "success" && s !== "succeeded" && s !== "paid") return sum;
    const amount = parseFloat(a.amount || a.total || 0);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
  return total > 0 ? total.toFixed(2) : null;
}

export function mapSealToUnified(sub) {
  const items = Array.isArray(sub.items) ? sub.items : [];
  const firstItem = items[0] || {};
  const shipping = sub.shipping_address || sub.shippingAddress || {};
  const billingAttempts = sub.billing_attempts || sub.billingAttempts || [];

  const lastCharge = lastBillingAttemptDate(billingAttempts);
  const totalRevenue = totalRevenueFromAttempts(billingAttempts);

  const billingInterval = sub.billing_interval || sub.billingInterval || {};
  const intervalCount =
    billingInterval.interval_count ||
    billingInterval.intervalCount ||
    sub.billing_interval_count ||
    1;
  const intervalUnit =
    billingInterval.interval ||
    billingInterval.unit ||
    sub.billing_interval_unit ||
    "month";

  const totalCharges = billingAttempts.filter((a) => {
    const s = String(a.status || "").toLowerCase();
    return s === "success" || s === "succeeded" || s === "paid";
  }).length;

  return {
    subscription_id: String(sub.id ?? sub.internal_id ?? ""),
    customer_id: String(sub.customer_id ?? sub.shopify_customer_id ?? ""),
    customer_email: sub.email || sub.customer_email || "",
    customer_first_name: sub.first_name || shipping.first_name || "",
    customer_last_name: sub.last_name || shipping.last_name || "",
    customer_phone: shipping.phone || sub.phone || "",
    customer_tag: "",
    subscription_status: normalizeStatus(sub.status),
    product_title: firstItem.product_title || firstItem.title || "",
    variant_title: firstItem.variant_title || "",
    sku: firstItem.sku || "",
    quantity: parseInt(firstItem.quantity, 10) || 0,
    price_per_cycle: parseFloat(firstItem.price || firstItem.unit_price || 0) || 0,
    currency: sub.currency || "USD",
    billing_interval: formatInterval(intervalCount, intervalUnit),
    billing_interval_unit: String(intervalUnit).toLowerCase(),
    next_charge_date: formatDate(sub.next_charge_date || sub.next_billing_date),
    last_charge_date: lastCharge,
    subscription_start_date: formatDate(sub.order_placed || sub.created_at),
    cancellation_date: formatDate(sub.cancelled_at || sub.cancelled_on),
    cancellation_reason: sub.cancellation_reason || null,
    total_charges_to_date: totalCharges || null,
    total_revenue_to_date: totalRevenue,
    discount_code: firstItem.discount_code || sub.discount_code || null,
    discount_value: null,
    shipping_address_1: shipping.address1 || shipping.address_1 || "",
    shipping_city: shipping.city || "",
    shipping_province: shipping.province || shipping.state || "",
    shipping_country: shipping.country_code || shipping.country || "",
    shipping_zip: shipping.zip || shipping.postal_code || "",
    _source: "seal",
  };
}
