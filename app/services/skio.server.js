const GRAPHQL_URL = "https://graphql.skio.com/v1/graphql";
const PAGE_SIZE = 100;
const RATE_LIMIT_DELAY = 100;
const MAX_RETRIES = 3;

function headers(apiKey) {
  return {
    authorization: `API ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function skioRequest(query, apiKey, variables = {}, retries = 0) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid Skio API key");
  }

  if (res.status === 429) {
    if (retries >= MAX_RETRIES) {
      throw new Error("Skio rate limit exceeded after retries");
    }
    const delay = 1000 * Math.pow(2, retries);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return skioRequest(query, apiKey, variables, retries + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Skio API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();

  if (data.errors && data.errors.length > 0) {
    const messages = data.errors.map((e) => e.message).join("; ");
    if (/jwt|unauthor|access denied|api key|token/i.test(messages)) {
      throw new Error(`Invalid Skio API key: ${messages}`);
    }
    throw new Error(`Skio GraphQL error: ${messages}`);
  }

  return data.data;
}

const VERIFY_QUERY = `
  query Verify {
    Subscriptions(limit: 1) {
      id
    }
  }
`;

export async function verifySkioApiKey(apiKey) {
  try {
    await skioRequest(VERIFY_QUERY, apiKey);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

const SUBSCRIPTIONS_QUERY = `
  query GetSubscriptions($limit: Int!, $offset: Int!) {
    Subscriptions(
      limit: $limit
      offset: $offset
      order_by: { createdAt: desc }
    ) {
      id
      platformId
      status
      createdAt
      cancelledAt
      cancellationReason
      nextBillingDate
      billingPolicyInterval
      billingPolicyIntervalCount
      currencyCode
      StorefrontUser {
        platformId
        email
        firstName
        lastName
        phone
      }
      SubscriptionLines {
        quantity
        priceWithoutDiscount
        ProductVariant {
          title
          sku
          price
          Product {
            title
          }
        }
      }
      ShippingAddress {
        address1
        address2
        city
        province
        zip
        country
        countryCode
      }
      Discounts {
        code
      }
    }
  }
`;

export async function fetchSkioSubscriptions(apiKey, { limit } = {}) {
  const results = [];
  let offset = 0;

  while (true) {
    const pageSize = limit
      ? Math.min(PAGE_SIZE, limit - results.length)
      : PAGE_SIZE;
    if (pageSize <= 0) break;

    const data = await skioRequest(SUBSCRIPTIONS_QUERY, apiKey, {
      limit: pageSize,
      offset,
    });

    const subscriptions = data?.Subscriptions || [];
    if (subscriptions.length === 0) break;

    results.push(...subscriptions);

    if (limit && results.length >= limit) {
      return results.slice(0, limit);
    }

    if (subscriptions.length < pageSize) break;

    offset += subscriptions.length;
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
  }

  return results;
}

function normalizeStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "active";
  if (s === "paused") return "paused";
  if (s === "cancelled" || s === "canceled" || s === "churned") return "cancelled";
  if (s === "expired") return "expired";
  if (s === "failed" || s === "3ds_pending") return "failed";
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

function formatInterval(count, unit) {
  const num = parseInt(count, 10) || 1;
  const u = String(unit || "month").toLowerCase();
  return `Every ${num} ${u}${num > 1 ? "s" : ""}`;
}

export function mapSkioToUnified(sub) {
  const user = sub.StorefrontUser || {};
  const lines = Array.isArray(sub.SubscriptionLines) ? sub.SubscriptionLines : [];
  const firstLine = lines[0] || {};
  const variant = firstLine.ProductVariant || {};
  const product = variant.Product || {};
  const shipping = sub.ShippingAddress || {};
  const discounts = Array.isArray(sub.Discounts) ? sub.Discounts : [];

  const subscriptionId = sub.platformId
    ? String(sub.platformId).replace("gid://shopify/SubscriptionContract/", "")
    : String(sub.id || "");

  const customerId = user.platformId
    ? String(user.platformId).replace("gid://shopify/Customer/", "")
    : "";

  const totalRevenue = lines.reduce((sum, line) => {
    const price = parseFloat(line.priceWithoutDiscount || 0);
    const qty = parseInt(line.quantity, 10) || 1;
    return sum + price * qty;
  }, 0);

  return {
    subscription_id: subscriptionId,
    customer_id: customerId,
    customer_email: user.email || "",
    customer_first_name: user.firstName || "",
    customer_last_name: user.lastName || "",
    customer_phone: user.phone || "",
    customer_tag: "",
    subscription_status: normalizeStatus(sub.status),
    product_title: product.title || variant.title || "",
    variant_title: variant.title || "",
    sku: variant.sku || "",
    quantity: parseInt(firstLine.quantity, 10) || 0,
    price_per_cycle:
      parseFloat(firstLine.priceWithoutDiscount) ||
      parseFloat(variant.price) ||
      0,
    currency: sub.currencyCode || "USD",
    billing_interval: formatInterval(
      sub.billingPolicyIntervalCount,
      sub.billingPolicyInterval,
    ),
    billing_interval_unit: String(sub.billingPolicyInterval || "month").toLowerCase(),
    next_charge_date: formatDate(sub.nextBillingDate),
    last_charge_date: null,
    subscription_start_date: formatDate(sub.createdAt),
    cancellation_date: formatDate(sub.cancelledAt),
    cancellation_reason: sub.cancellationReason || null,
    total_charges_to_date: null,
    total_revenue_to_date: totalRevenue > 0 ? totalRevenue.toFixed(2) : null,
    discount_code: discounts[0]?.code || null,
    discount_value: null,
    shipping_address_1: shipping.address1 || "",
    shipping_city: shipping.city || "",
    shipping_province: shipping.province || "",
    shipping_country: shipping.countryCode || shipping.country || "",
    shipping_zip: shipping.zip || "",
    _source: "skio",
  };
}
