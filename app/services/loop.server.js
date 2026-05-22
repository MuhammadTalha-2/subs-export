const BASE_URL = "https://api.loopsubscriptions.com/admin/2023-10";
const PAGE_SIZE = 100;
const RATE_LIMIT_DELAY = 250;
const MAX_RETRIES = 3;

function headers(apiKey) {
  return {
    "X-Loop-Token": apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function loopRequest(endpoint, apiKey, retries = 0) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: headers(apiKey),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid Loop API token");
  }

  if (res.status === 429) {
    if (retries >= MAX_RETRIES) {
      throw new Error("Loop rate limit exceeded after retries");
    }
    const delay = 1000 * Math.pow(2, retries);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return loopRequest(endpoint, apiKey, retries + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Loop API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  if (json && json.success === false) {
    throw new Error(`Loop API error: ${json.message || "Unknown error"}`);
  }
  return json;
}

export async function verifyLoopApiKey(apiKey) {
  try {
    await loopRequest("/subscription?pageNo=1&pageSize=1", apiKey);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export async function fetchLoopSubscriptions(apiKey, { limit } = {}) {
  const results = [];
  let pageNo = 1;

  while (true) {
    const pageSize = limit
      ? Math.min(PAGE_SIZE, limit - results.length)
      : PAGE_SIZE;
    if (pageSize <= 0) break;

    const json = await loopRequest(
      `/subscription?pageNo=${pageNo}&pageSize=${pageSize}`,
      apiKey,
    );

    const subscriptions = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.data?.subscriptions)
        ? json.data.subscriptions
        : [];

    if (subscriptions.length === 0) break;

    results.push(...subscriptions);

    if (limit && results.length >= limit) {
      return results.slice(0, limit);
    }

    if (subscriptions.length < pageSize) break;

    pageNo += 1;
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
    const d = typeof value === "number" ? new Date(value * 1000) : new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

function formatInterval(count, unit) {
  const num = parseInt(count, 10) || 1;
  const u = String(unit || "month").toLowerCase();
  return `Every ${num} ${u}${num > 1 ? "s" : ""}`;
}

export function mapLoopToUnified(sub) {
  const customer = sub.customer || {};
  const shipping = sub.shippingAddress || {};
  const lines = Array.isArray(sub.lines) ? sub.lines : [];
  const firstLine = lines[0] || {};
  const discounts = Array.isArray(sub.discounts) ? sub.discounts : [];
  const billingPolicy = sub.billingPolicy || {};

  const productTitle =
    firstLine.productTitle ||
    firstLine.product_title ||
    firstLine.title ||
    "";
  const variantTitle =
    firstLine.variantTitle || firstLine.variant_title || "";
  const sku = firstLine.sku || firstLine.variantSku || "";
  const quantity = parseInt(firstLine.quantity, 10) || 0;
  const linePrice =
    parseFloat(firstLine.price) ||
    parseFloat(firstLine.discountedPrice) ||
    parseFloat(firstLine.unitPrice) ||
    0;

  const totalRevenue =
    parseFloat(sub.totalLineItemDiscountedPrice) ||
    parseFloat(sub.totalLineItemPrice) ||
    0;
  const completedOrders = parseInt(sub.completedOrdersCount, 10) || 0;
  const computedRevenue =
    totalRevenue > 0 && completedOrders > 0
      ? (totalRevenue * completedOrders).toFixed(2)
      : null;

  const customerId = customer.shopifyId
    ? String(customer.shopifyId)
    : String(customer.id || "");

  return {
    subscription_id: sub.shopifyId
      ? String(sub.shopifyId)
      : String(sub.id || ""),
    customer_id: customerId,
    customer_email: customer.email || "",
    customer_first_name: shipping.firstName || customer.firstName || "",
    customer_last_name: shipping.lastName || customer.lastName || "",
    customer_phone: shipping.phone || customer.phone || "",
    customer_tag: "",
    subscription_status: normalizeStatus(sub.status),
    product_title: productTitle,
    variant_title: variantTitle,
    sku,
    quantity,
    price_per_cycle: linePrice,
    currency: sub.currencyCode || "USD",
    billing_interval: formatInterval(
      billingPolicy.intervalCount,
      billingPolicy.interval,
    ),
    billing_interval_unit: String(billingPolicy.interval || "month").toLowerCase(),
    next_charge_date: formatDate(sub.nextBillingDateEpoch),
    last_charge_date: null,
    subscription_start_date: formatDate(sub.createdAt),
    cancellation_date: formatDate(sub.cancelledAt),
    cancellation_reason: sub.cancellationReason || sub.cancellationComment || null,
    total_charges_to_date: completedOrders || null,
    total_revenue_to_date: computedRevenue,
    discount_code: discounts[0]?.title || discounts[0]?.code || null,
    discount_value: discounts[0]?.value
      ? parseFloat(discounts[0].value) || null
      : null,
    shipping_address_1: shipping.address1 || "",
    shipping_city: shipping.city || "",
    shipping_province: shipping.provinceCode || shipping.province || "",
    shipping_country: shipping.countryCode || shipping.country || "",
    shipping_zip: shipping.zip || "",
    _source: "loop",
  };
}
