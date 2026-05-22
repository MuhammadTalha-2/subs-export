const FIRST_NAMES = [
  "Emma", "Liam", "Olivia", "Noah", "Ava", "James", "Sophia", "Oliver",
  "Isabella", "William", "Mia", "Ethan", "Charlotte", "Mason", "Amelia",
  "Lucas", "Harper", "Logan", "Evelyn", "Alexander",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
  "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
];

const PRODUCTS = [
  { title: "Daily Vitamin Pack", variants: ["30-Day Supply", "60-Day Supply", "90-Day Supply"], sku: "VIT" },
  { title: "Organic Coffee Blend", variants: ["Ground 12oz", "Whole Bean 12oz", "Ground 24oz"], sku: "COF" },
  { title: "Protein Powder", variants: ["Chocolate 2lb", "Vanilla 2lb", "Strawberry 2lb"], sku: "PRO" },
  { title: "Skincare Essentials Box", variants: ["Basic", "Premium", "Deluxe"], sku: "SKN" },
  { title: "Pet Food - Premium Kibble", variants: ["Small Dog 5lb", "Large Dog 15lb", "Cat 5lb"], sku: "PET" },
  { title: "Meal Prep Kit", variants: ["2 Person", "4 Person", "Family Size"], sku: "MEL" },
  { title: "Green Juice Cleanse", variants: ["3-Day", "5-Day", "7-Day"], sku: "JUC" },
  { title: "Artisan Tea Collection", variants: ["Black Tea", "Green Tea", "Herbal Blend"], sku: "TEA" },
];

const COUNTRIES = ["US", "CA", "GB", "AU", "DE", "FR", "NL", "NZ"];
const PROVINCES = {
  US: ["California", "New York", "Texas", "Florida", "Illinois", "Washington", "Oregon", "Colorado"],
  CA: ["Ontario", "British Columbia", "Quebec", "Alberta"],
  GB: ["England", "Scotland", "Wales"],
  AU: ["New South Wales", "Victoria", "Queensland"],
};
const CITIES = {
  US: ["Los Angeles", "New York", "Austin", "Miami", "Chicago", "Seattle", "Portland", "Denver"],
  CA: ["Toronto", "Vancouver", "Montreal", "Calgary"],
  GB: ["London", "Edinburgh", "Cardiff"],
  AU: ["Sydney", "Melbourne", "Brisbane"],
};
const TAGS = ["vip", "wholesale", "first-time", "loyalty", "influencer", ""];
const STATUSES = ["active", "active", "active", "active", "paused", "cancelled", "cancelled", "expired"];
const INTERVALS = [
  { unit: "month", freq: 1 },
  { unit: "month", freq: 2 },
  { unit: "month", freq: 3 },
  { unit: "week", freq: 1 },
  { unit: "week", freq: 2 },
];
const CANCEL_REASONS = [
  "Too expensive",
  "No longer needed",
  "Found a better alternative",
  "Moving",
  "Poor quality",
  "Ordered too much",
  null,
];
const DISCOUNTS = ["WELCOME10", "SAVE20", "VIP15", "LOYALTY25", "FIRST50", null, null, null];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(startDays, endDays) {
  const now = new Date();
  const offset = randomInt(startDays, endDays);
  const d = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

function randomPrice() {
  const prices = [9.99, 14.99, 19.99, 24.99, 29.99, 34.99, 39.99, 49.99, 59.99, 79.99];
  return pick(prices);
}

function generateRow(index) {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const country = pick(COUNTRIES);
  const province = pick(PROVINCES[country] || PROVINCES.US);
  const city = pick(CITIES[country] || CITIES.US);
  const product = pick(PRODUCTS);
  const variant = pick(product.variants);
  const status = pick(STATUSES);
  const interval = pick(INTERVALS);
  const price = randomPrice();
  const totalCharges = randomInt(1, 36);
  const discount = pick(DISCOUNTS);
  const discountValue = discount ? pick([5, 10, 15, 20, 25]) : null;
  const tags = [pick(TAGS), pick(TAGS)].filter(Boolean);

  const startDate = randomDate(-730, -30);
  const cancelDate = status === "cancelled" ? randomDate(-60, -1) : null;
  const nextCharge = status === "active" ? randomDate(1, 60) : null;
  const lastCharge = randomDate(-45, -1);

  return {
    subscription_id: `demo_${1000 + index}`,
    customer_id: `cust_${5000 + index}`,
    customer_email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 99)}@example.com`,
    customer_first_name: firstName,
    customer_last_name: lastName,
    customer_phone: `+1${randomInt(200, 999)}${randomInt(100, 999)}${randomInt(1000, 9999)}`,
    customer_tag: tags.join(", "),
    subscription_status: status,
    product_title: product.title,
    variant_title: variant,
    sku: `${product.sku}-${randomInt(100, 999)}`,
    quantity: randomInt(1, 5),
    price_per_cycle: price,
    currency: country === "GB" ? "GBP" : country === "AU" ? "AUD" : country === "CA" ? "CAD" : "USD",
    billing_interval: `Every ${interval.freq} ${interval.unit}${interval.freq > 1 ? "s" : ""}`,
    billing_interval_unit: interval.unit,
    next_charge_date: nextCharge,
    last_charge_date: lastCharge,
    subscription_start_date: startDate,
    cancellation_date: cancelDate,
    cancellation_reason: status === "cancelled" ? pick(CANCEL_REASONS) : null,
    total_charges_to_date: totalCharges,
    total_revenue_to_date: parseFloat((price * totalCharges).toFixed(2)),
    discount_code: discount,
    discount_value: discountValue,
    shipping_address_1: `${randomInt(100, 9999)} ${pick(["Main St", "Oak Ave", "Elm Dr", "Park Rd", "Maple Ln", "Cedar Blvd"])}`,
    shipping_city: city,
    shipping_province: province,
    shipping_country: country,
    shipping_zip: country === "US" ? String(randomInt(10000, 99999)) : `${String.fromCharCode(65 + randomInt(0, 25))}${randomInt(1, 9)}${String.fromCharCode(65 + randomInt(0, 25))} ${randomInt(1, 9)}${String.fromCharCode(65 + randomInt(0, 25))}${randomInt(1, 9)}`,
    _source: "demo",
  };
}

export function generateDemoData(count = 150) {
  return Array.from({ length: count }, (_, i) => generateRow(i));
}
