import { stringify } from "csv-stringify/sync";
import ExcelJS from "exceljs";
import db from "../db.server";
import { decrypt } from "../utils/encryption.server";
import {
  fetchRechargeSubscriptions,
  mapRechargeToUnified,
} from "./recharge.server";
import {
  fetchSealSubscriptions,
  mapSealToUnified,
} from "./seal.server";
import {
  fetchSkioSubscriptions,
  mapSkioToUnified,
} from "./skio.server";
import {
  fetchLoopSubscriptions,
  mapLoopToUnified,
} from "./loop.server";
import {
  fetchPayWhirlSubscriptions,
  mapPayWhirlToUnified,
} from "./paywhirl.server";
import {
  fetchBoldSubscriptions,
  mapBoldToUnified,
} from "./bold.server";
import { generateDemoData } from "./demo-data.server";
import { applyFilters } from "../utils/filters.server";
import { UNIFIED_FIELDS } from "../utils/unified-schema";
import { pushToGoogleSheets } from "./google-sheets.server";

/**
 * Plan limits — must match exactly what /app/plans (and the public pricing
 * page on the App Store listing) advertise. Update both places together.
 *
 * - maxExports: rolling 30-day cap on the number of exports the merchant can
 *   create; counter lives on shop.monthlyExportCount and resets when
 *   shop.billingCycleStart is older than 30 days.
 * - maxRows: per-export row cap; processExport() truncates the result set to
 *   this size and stamps an errorMessage explaining the truncation.
 * - formats: which output formats the merchant can pick when creating an
 *   export or schedule.
 * - maxTemplates: hard cap on saved templates per shop.
 * - allowSchedules: whether the merchant can create scheduled exports at all.
 * - allowSlackDelivery: whether the merchant can pick Slack as the delivery
 *   channel for a scheduled export (email is allowed on any plan that has
 *   schedules).
 */
export const PLAN_LIMITS = {
  free: {
    maxExports: 5,
    maxRows: 250,
    formats: ["csv"],
    maxTemplates: 0,
    allowSchedules: false,
    allowSlackDelivery: false,
  },
  growth: {
    maxExports: 50,
    maxRows: 5000,
    formats: ["csv", "xlsx", "gsheets"],
    maxTemplates: 10,
    allowSchedules: true,
    allowSlackDelivery: false,
  },
  pro: {
    maxExports: Infinity,
    maxRows: Infinity,
    formats: ["csv", "xlsx", "gsheets"],
    maxTemplates: Infinity,
    allowSchedules: true,
    allowSlackDelivery: true,
  },
};

export function getPlanLimits(planTier) {
  return PLAN_LIMITS[planTier] || PLAN_LIMITS.free;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Reset shop.monthlyExportCount when the 30-day billing cycle window has
 * elapsed (or has never been started). Returns the freshest shop record.
 *
 * Idempotent: callable on every export attempt. A null billingCycleStart is
 * treated as "start a fresh cycle now."
 */
async function rolloverBillingCycleIfDue(shop) {
  const now = new Date();
  const cycleAgeMs = shop.billingCycleStart
    ? now - shop.billingCycleStart
    : Infinity;

  if (cycleAgeMs >= THIRTY_DAYS_MS) {
    return db.shop.update({
      where: { id: shop.id },
      data: {
        billingCycleStart: now,
        monthlyExportCount: 0,
      },
    });
  }

  return shop;
}

function buildFilename(shopDomain, format, filters) {
  const shop = shopDomain.replace(".myshopify.com", "");
  const date = new Date().toISOString().split("T")[0];
  const filterTag = filters?.status?.length
    ? `_${filters.status.join("-")}`
    : "";
  return `subsexport_${shop}${filterTag}_${date}.${format === "xlsx" ? "xlsx" : "csv"}`;
}

/**
 * Check whether the merchant is allowed to create a new export with the given
 * format under their current plan. Performs the billing-cycle rollover as a
 * side effect so callers don't have to.
 *
 * Returns either `{ allowed: true, maxRows, plan }` or
 * `{ allowed: false, reason }`.
 */
export async function checkExportLimits(shop, { format } = {}) {
  const refreshedShop = await rolloverBillingCycleIfDue(shop);
  const limits = getPlanLimits(refreshedShop.plan);

  if (refreshedShop.monthlyExportCount >= limits.maxExports) {
    return {
      allowed: false,
      reason:
        limits.maxExports === Infinity
          ? "Export limit reached."
          : `Monthly export limit reached (${limits.maxExports} on the ${refreshedShop.plan} plan). Upgrade for more exports this cycle.`,
    };
  }

  if (format && !limits.formats.includes(format)) {
    return {
      allowed: false,
      reason: `The ${format.toUpperCase()} format is not available on the ${refreshedShop.plan} plan. Upgrade to unlock additional formats.`,
    };
  }

  return {
    allowed: true,
    maxRows: limits.maxRows,
    plan: refreshedShop.plan,
  };
}

async function fetchAllSubscriptionData(shopId) {
  const connections = await db.appConnection.findMany({
    where: { shopId, status: "connected" },
  });

  let allRows = [];

  for (const conn of connections) {
    if (conn.appName === "demo") {
      allRows.push(...generateDemoData(150));
    } else if (conn.appName === "recharge") {
      const apiKey = decrypt(conn.apiKeyEnc);
      const rawSubs = await fetchRechargeSubscriptions(apiKey);
      allRows.push(...rawSubs.map(mapRechargeToUnified));
    } else if (conn.appName === "seal") {
      const apiKey = decrypt(conn.apiKeyEnc);
      const rawSubs = await fetchSealSubscriptions(apiKey);
      allRows.push(...rawSubs.map(mapSealToUnified));
    } else if (conn.appName === "skio") {
      const apiKey = decrypt(conn.apiKeyEnc);
      const rawSubs = await fetchSkioSubscriptions(apiKey);
      allRows.push(...rawSubs.map(mapSkioToUnified));
    } else if (conn.appName === "loop") {
      const apiKey = decrypt(conn.apiKeyEnc);
      const rawSubs = await fetchLoopSubscriptions(apiKey);
      allRows.push(...rawSubs.map(mapLoopToUnified));
    } else if (conn.appName === "paywhirl") {
      const creds = JSON.parse(decrypt(conn.apiKeyEnc));
      const rawSubs = await fetchPayWhirlSubscriptions(creds);
      allRows.push(...rawSubs.map(mapPayWhirlToUnified));
    } else if (conn.appName === "bold") {
      const creds = JSON.parse(decrypt(conn.apiKeyEnc));
      const rawSubs = await fetchBoldSubscriptions(creds);
      allRows.push(...rawSubs.map(mapBoldToUnified));
    }
  }

  return allRows;
}

function generateCsvBuffer(rows, fields) {
  const headers = fields.map((f) => f.key);
  const labels = fields.map((f) => f.label);

  const data = rows.map((row) =>
    headers.map((key) => {
      const val = row[key];
      if (val === null || val === undefined) return "";
      return String(val);
    }),
  );

  const csvContent = stringify([labels, ...data]);
  return Buffer.from("﻿" + csvContent, "utf-8");
}

async function generateXlsxBuffer(rows, fields, filters) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SubsExport";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Subscriptions");

  sheet.columns = fields.map((f) => ({
    header: f.label,
    key: f.key,
    width: f.type === "date" ? 14 : f.type === "decimal" ? 12 : 20,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8E8E8" },
  };

  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const row of rows) {
    const rowData = {};
    for (const f of fields) {
      let val = row[f.key];
      if (f.type === "decimal" && val != null) val = parseFloat(val);
      if (f.type === "integer" && val != null) val = parseInt(val, 10);
      rowData[f.key] = val ?? "";
    }
    sheet.addRow(rowData);
  }

  const infoSheet = workbook.addWorksheet("Export Info");
  infoSheet.columns = [
    { header: "Property", key: "prop", width: 25 },
    { header: "Value", key: "val", width: 40 },
  ];
  infoSheet.getRow(1).font = { bold: true };

  infoSheet.addRow({ prop: "Export Date", val: new Date().toISOString() });
  infoSheet.addRow({ prop: "Total Rows", val: rows.length });
  infoSheet.addRow({ prop: "Fields Exported", val: fields.length });

  if (filters) {
    if (filters.status?.length) {
      infoSheet.addRow({
        prop: "Status Filter",
        val: filters.status.join(", "),
      });
    }
    if (filters.product) {
      infoSheet.addRow({ prop: "Product Filter", val: filters.product });
    }
  }

  return workbook.xlsx.writeBuffer();
}

export async function processExport(jobId) {
  const job = await db.exportJob.findUnique({
    where: { id: jobId },
    include: { shop: true },
  });

  if (!job) throw new Error("Export job not found");

  await db.exportJob.update({
    where: { id: jobId },
    data: { status: "processing" },
  });

  try {
    const allRows = await fetchAllSubscriptionData(job.shopId);
    const filters = job.filtersJson || {};
    const filtered = applyFilters(allRows, filters);

    const limits = getPlanLimits(job.shop.plan);

    // Defense-in-depth: an action handler or scheduler should already have
    // filtered the format against limits.formats, but guard inside processExport
    // too in case a future caller forgets. Mark the job failed so the merchant
    // sees a clear error in their export history.
    if (!limits.formats.includes(job.format)) {
      throw new Error(
        `The ${job.format.toUpperCase()} format is not available on the ${job.shop.plan} plan.`,
      );
    }

    const maxRows = limits.maxRows;
    const truncated = filtered.length > maxRows;
    const rows = truncated ? filtered.slice(0, maxRows) : filtered;

    const fields = UNIFIED_FIELDS;

    if (job.format === "gsheets") {
      const result = await pushToGoogleSheets(
        job.shopId,
        rows,
        filters,
        job.shop.shopDomain,
      );

      await db.exportJob.update({
        where: { id: jobId },
        data: {
          status: "complete",
          rowCount: rows.length,
          filePath: result.spreadsheetUrl,
          completedAt: new Date(),
          errorMessage: truncated
            ? `Export truncated to ${maxRows} rows (${job.shop.plan} plan limit). ${filtered.length} total matched.`
            : null,
        },
      });

      await db.shop.update({
        where: { id: job.shopId },
        data: { monthlyExportCount: { increment: 1 } },
      });

      return { success: true, rowCount: rows.length, truncated, spreadsheetUrl: result.spreadsheetUrl };
    }

    let buffer;
    if (job.format === "xlsx") {
      buffer = await generateXlsxBuffer(rows, fields, filters);
    } else {
      buffer = generateCsvBuffer(rows, fields);
    }

    // Normalize to Node Buffer — exceljs.writeBuffer() returns an ArrayBuffer/Uint8Array
    // depending on version, and Prisma's Bytes column needs Buffer/Uint8Array on insert.
    const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    const filename = buildFilename(job.shop.shopDomain, job.format, filters);

    await db.exportJob.update({
      where: { id: jobId },
      data: {
        status: "complete",
        rowCount: rows.length,
        filePath: filename,
        fileContent: fileBuffer,
        completedAt: new Date(),
        errorMessage: truncated
          ? `Export truncated to ${maxRows} rows (${job.shop.plan} plan limit). ${filtered.length} total matched.`
          : null,
      },
    });

    await db.shop.update({
      where: { id: job.shopId },
      data: { monthlyExportCount: { increment: 1 } },
    });

    return { success: true, rowCount: rows.length, truncated };
  } catch (error) {
    await db.exportJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage: error.message,
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

/**
 * Look up an export's file bytes by job id. Returns null when the job has no
 * stored content (e.g. Google Sheets exports, failed jobs, or rows pre-dating
 * the DB-backed storage migration).
 */
export async function getExportFileContent(jobId) {
  const job = await db.exportJob.findUnique({
    where: { id: jobId },
    select: { fileContent: true, filePath: true, format: true },
  });
  if (!job || !job.fileContent) return null;
  return {
    filename: job.filePath,
    format: job.format,
    buffer: Buffer.from(job.fileContent),
  };
}

/**
 * Clear stored bytes for a job (e.g. when the merchant deletes the export from
 * history). The ExportJob row itself is removed by the caller; this helper is
 * kept for symmetry with the old disk-based API in case future callers want to
 * free storage without deleting the audit row.
 */
export async function clearExportFileContent(jobId) {
  if (!jobId) return;
  await db.exportJob.update({
    where: { id: jobId },
    data: { fileContent: null },
  });
}
