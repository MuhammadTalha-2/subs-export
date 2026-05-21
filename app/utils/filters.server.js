export function applyFilters(rows, filters) {
  if (!filters || Object.keys(filters).length === 0) return rows;

  return rows.filter((row) => {
    if (filters.status?.length > 0) {
      if (!filters.status.includes(row.subscription_status)) return false;
    }

    if (filters.next_charge_from) {
      if (!row.next_charge_date || row.next_charge_date < filters.next_charge_from)
        return false;
    }
    if (filters.next_charge_to) {
      if (!row.next_charge_date || row.next_charge_date > filters.next_charge_to)
        return false;
    }

    if (filters.start_date_from) {
      if (
        !row.subscription_start_date ||
        row.subscription_start_date < filters.start_date_from
      )
        return false;
    }
    if (filters.start_date_to) {
      if (
        !row.subscription_start_date ||
        row.subscription_start_date > filters.start_date_to
      )
        return false;
    }

    if (filters.cancellation_from) {
      if (!row.cancellation_date || row.cancellation_date < filters.cancellation_from)
        return false;
    }
    if (filters.cancellation_to) {
      if (!row.cancellation_date || row.cancellation_date > filters.cancellation_to)
        return false;
    }

    if (filters.product) {
      const search = filters.product.toLowerCase();
      const matchesProduct = row.product_title?.toLowerCase().includes(search);
      const matchesVariant = row.variant_title?.toLowerCase().includes(search);
      const matchesSku = row.sku?.toLowerCase().includes(search);
      if (!matchesProduct && !matchesVariant && !matchesSku) return false;
    }

    if (filters.billing_interval?.length > 0) {
      if (!filters.billing_interval.includes(row.billing_interval_unit))
        return false;
    }

    if (filters.customer_tag) {
      const tags = row.customer_tag?.toLowerCase().split(",").map((t) => t.trim()) || [];
      if (!tags.some((t) => t.includes(filters.customer_tag.toLowerCase())))
        return false;
    }

    if (filters.country?.length > 0) {
      if (!filters.country.includes(row.shipping_country)) return false;
    }

    if (filters.charges_min != null) {
      if ((row.total_charges_to_date || 0) < filters.charges_min) return false;
    }
    if (filters.charges_max != null) {
      if ((row.total_charges_to_date || 0) > filters.charges_max) return false;
    }

    if (filters.revenue_min != null) {
      if ((row.total_revenue_to_date || 0) < filters.revenue_min) return false;
    }
    if (filters.revenue_max != null) {
      if ((row.total_revenue_to_date || 0) > filters.revenue_max) return false;
    }

    return true;
  });
}

export function parseFiltersFromParams(searchParams) {
  const filters = {};

  const status = searchParams.getAll("status");
  if (status.length > 0) filters.status = status;

  const fields = [
    "next_charge_from",
    "next_charge_to",
    "start_date_from",
    "start_date_to",
    "cancellation_from",
    "cancellation_to",
    "product",
    "customer_tag",
  ];

  for (const field of fields) {
    const val = searchParams.get(field);
    if (val) filters[field] = val;
  }

  const billingInterval = searchParams.getAll("billing_interval");
  if (billingInterval.length > 0) filters.billing_interval = billingInterval;

  const country = searchParams.getAll("country");
  if (country.length > 0) filters.country = country;

  const numericFields = [
    "charges_min",
    "charges_max",
    "revenue_min",
    "revenue_max",
  ];
  for (const field of numericFields) {
    const val = searchParams.get(field);
    if (val != null && val !== "") filters[field] = parseFloat(val);
  }

  return filters;
}
