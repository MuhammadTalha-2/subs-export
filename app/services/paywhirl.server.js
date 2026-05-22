const VARIANTS = {
  classic: "https://api.paywhirl.com",
  shopify: "https://api.shop.paywhirl.com/2022-04",
};

const PAGE_SIZE = 100;
const RATE_LIMIT_DELAY = 250;
const MAX_RETRIES = 3;

function baseUrl(variant) {
  return VARIANTS[variant] || VARIANTS.classic;
}

function headers(apiKey, apiSecret) {
  return {
    "api-key": apiKey,
    "api-secret": apiSecret,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function paywhirlRequest(endpoint, creds, retries = 0) {
  const url = `${baseUrl(creds.variant)}${endpoint}`;
  const res = await fetch(url, {
    headers: headers(creds.apiKey, creds.apiSecret),
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[PayWhirl] ${creds.variant} ${url} → ${res.status} (keyPrefix=${(creds.apiKey || "").slice(0, 6)})`,
    );
  }

  if (res.status === 401 || res.status === 403) {
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      // ignore
    }

    let message = "Invalid PayWhirl API key or secret.";
    try {
      const parsed = JSON.parse(bodyText);
      const apiError = String(parsed?.error || parsed?.message || "");
      if (/does not have access/i.test(apiError)) {
        message =
          "Your PayWhirl account doesn't have API access. Upgrade to a paid plan or contact PayWhirl support to enable API access.";
      } else if (apiError) {
        message = apiError;
      }
    } catch {
      // body wasn't JSON — keep default
    }

    throw new Error(message);
  }

  if (res.status === 429) {
    if (retries >= MAX_RETRIES) {
      throw new Error("PayWhirl rate limit exceeded after retries");
    }
    const reset = parseInt(res.headers.get("x-ratelimit-reset") || "0", 10);
    const now = Math.floor(Date.now() / 1000);
    const waitSec = reset > now ? reset - now : Math.pow(2, retries);
    await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
    return paywhirlRequest(endpoint, creds, retries + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayWhirl API error ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json();
}

export async function verifyPayWhirlCredentials(creds) {
  try {
    await paywhirlRequest("/test", creds);
    return { valid: true };
  } catch (testErr) {
    try {
      await paywhirlRequest("/customers?limit=1", creds);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

async function fetchPlans(creds) {
  try {
    const data = await paywhirlRequest("/plans?limit=100", creds);
    const plans = Array.isArray(data) ? data : data.data || data.plans || [];
    const map = {};
    for (const p of plans) {
      map[String(p.id)] = p;
    }
    return map;
  } catch {
    return {};
  }
}

async function fetchAllCustomers(creds, { limit } = {}) {
  const all = [];
  let afterId = null;

  while (true) {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    if (afterId) params.set("after_id", String(afterId));

    const data = await paywhirlRequest(
      `/customers?${params.toString()}`,
      creds,
    );
    const customers = Array.isArray(data) ? data : data.data || data.customers || [];

    if (customers.length === 0) break;

    all.push(...customers);

    if (limit && all.length >= limit) {
      return all.slice(0, limit);
    }

    if (customers.length < PAGE_SIZE) break;
    afterId = customers[customers.length - 1].id;
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
  }

  return all;
}

async function fetchCustomerSubscriptions(customerId, creds) {
  try {
    const data = await paywhirlRequest(
      `/subscriptions/${customerId}?status=all`,
      creds,
    );
    if (Array.isArray(data)) return data;
    return data.data || data.subscriptions || [];
  } catch {
    return [];
  }
}

export async function fetchPayWhirlSubscriptions(creds, { limit } = {}) {
  const customers = await fetchAllCustomers(creds, {
    limit: limit ? Math.min(limit * 2, 1000) : undefined,
  });
  const plans = await fetchPlans(creds);

  const enriched = [];
  for (const customer of customers) {
    const subs = await fetchCustomerSubscriptions(customer.id, creds);
    for (const sub of subs) {
      enriched.push({
        ...sub,
        _customer: customer,
        _plan: plans[String(sub.plan_id)] || null,
      });
      if (limit && enriched.length >= limit) {
        return enriched.slice(0, limit);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
  }

  return enriched;
}

function normalizeStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "active";
  if (s === "paused" || s === "pause") return "paused";
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

function formatInterval(value, unit) {
  const num = parseInt(value, 10) || 1;
  const u = String(unit || "month").toLowerCase();
  return `Every ${num} ${u}${num > 1 ? "s" : ""}`;
}

export function mapPayWhirlToUnified(sub) {
  const customer = sub._customer || {};
  const plan = sub._plan || {};

  const price =
    parseFloat(plan.amount) ||
    parseFloat(plan.billing_amount) ||
    parseFloat(sub.amount) ||
    0;

  return {
    subscription_id: String(sub.id || ""),
    customer_id: String(sub.customer_id || customer.id || ""),
    customer_email: customer.email || "",
    customer_first_name: customer.first_name || "",
    customer_last_name: customer.last_name || "",
    customer_phone: customer.phone || customer.mobile || "",
    customer_tag: "",
    subscription_status: normalizeStatus(sub.status),
    product_title: plan.name || plan.title || sub.plan_name || "",
    variant_title: "",
    sku: plan.sku || "",
    quantity: parseInt(sub.quantity, 10) || 1,
    price_per_cycle: price,
    currency: plan.currency || sub.currency || "USD",
    billing_interval: formatInterval(
      plan.billing_frequency,
      plan.billing_interval,
    ),
    billing_interval_unit: String(plan.billing_interval || "month").toLowerCase(),
    next_charge_date: formatDate(sub.next_payment_date),
    last_charge_date: formatDate(sub.current_period_start),
    subscription_start_date: formatDate(sub.created_at),
    cancellation_date: formatDate(sub.canceled_at || sub.cancelled_at),
    cancellation_reason: sub.cancellation_reason || null,
    total_charges_to_date: null,
    total_revenue_to_date: null,
    discount_code: sub.coupon_code || sub.discount_code || null,
    discount_value: null,
    shipping_address_1: customer.address_1 || customer.address1 || "",
    shipping_city: customer.city || "",
    shipping_province: customer.state || customer.province || "",
    shipping_country: customer.country || "",
    shipping_zip: customer.zip || customer.postal_code || "",
    _source: "paywhirl",
  };
}
