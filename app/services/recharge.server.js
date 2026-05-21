const BASE_URL = "https://api.rechargeapps.com";
const MAX_PER_PAGE = 250;
const RATE_LIMIT_DELAY = 500;
const MAX_RETRIES = 3;

function headers(apiKey) {
  return {
    "X-Recharge-Access-Token": apiKey,
    "X-Recharge-Version": "2021-11",
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function rechargeRequest(endpoint, apiKey, retries = 0) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: headers(apiKey),
  });

  if (res.status === 429) {
    if (retries >= MAX_RETRIES) {
      throw new Error("ReCharge rate limit exceeded after retries");
    }
    const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
    const delay = retryAfter * 1000 * Math.pow(2, retries);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return rechargeRequest(endpoint, apiKey, retries + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ReCharge API error ${res.status}: ${body}`);
  }

  return res.json();
}

export async function verifyRechargeApiKey(apiKey) {
  try {
    const data = await rechargeRequest("/subscriptions?limit=1", apiKey);
    const count =
      data.subscriptions?.length >= 0 ? data.subscriptions.length : 0;
    return { valid: true, count };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export async function fetchRechargeSubscriptions(apiKey, { limit } = {}) {
  const results = [];
  let cursor = null;
  let hasMore = true;
  const pageSize = limit ? Math.min(limit, MAX_PER_PAGE) : MAX_PER_PAGE;

  while (hasMore) {
    let endpoint = `/subscriptions?limit=${pageSize}`;
    if (cursor) {
      endpoint += `&cursor=${cursor}`;
    }

    const data = await rechargeRequest(endpoint, apiKey);
    const subscriptions = data.subscriptions || [];
    results.push(...subscriptions);

    if (limit && results.length >= limit) {
      return results.slice(0, limit);
    }

    cursor = data.next_cursor || null;
    hasMore = !!cursor && subscriptions.length === pageSize;

    if (hasMore) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  return results;
}

function normalizeStatus(rechargeStatus) {
  const map = {
    active: "active",
    paused: "paused",
    cancelled: "cancelled",
    expired: "expired",
  };
  return map[rechargeStatus?.toLowerCase()] || rechargeStatus?.toLowerCase() || "active";
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toISOString().split("T")[0];
  } catch {
    return null;
  }
}

function formatInterval(unit, frequency) {
  const num = parseInt(frequency, 10) || 1;
  const unitStr = unit?.toLowerCase() || "month";
  return `Every ${num} ${unitStr}${num > 1 ? "s" : ""}`;
}

export function mapRechargeToUnified(sub) {
  const address = sub.address || {};
  const externalVariantId = sub.external_variant_id || sub.shopify_variant_id;

  return {
    subscription_id: String(sub.id || ""),
    customer_id: String(sub.customer_id || ""),
    customer_email: sub.email || "",
    customer_first_name: address.first_name || "",
    customer_last_name: address.last_name || "",
    customer_phone: address.phone || "",
    customer_tag: "",
    subscription_status: normalizeStatus(sub.status),
    product_title: sub.product_title || "",
    variant_title: sub.variant_title || "",
    sku: sub.sku || "",
    quantity: sub.quantity || 0,
    price_per_cycle: parseFloat(sub.price) || 0,
    currency: sub.presentment_currency || "USD",
    billing_interval: formatInterval(
      sub.order_interval_unit,
      sub.order_interval_frequency,
    ),
    billing_interval_unit: sub.order_interval_unit?.toLowerCase() || "month",
    next_charge_date: formatDate(sub.next_charge_scheduled_at),
    last_charge_date: null,
    subscription_start_date: formatDate(sub.created_at),
    cancellation_date: formatDate(sub.cancelled_at),
    cancellation_reason: sub.cancellation_reason || null,
    total_charges_to_date: null,
    total_revenue_to_date: null,
    discount_code: null,
    discount_value: null,
    shipping_address_1: address.address1 || "",
    shipping_city: address.city || "",
    shipping_province: address.province || "",
    shipping_country: address.country_code || address.country || "",
    shipping_zip: address.zip || "",
    _source: "recharge",
    _external_variant_id: externalVariantId || null,
  };
}
