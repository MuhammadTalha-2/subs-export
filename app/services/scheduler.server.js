import db from "../db.server";
import { processExport, getPlanLimits } from "./export.server";
import { sendExportEmail } from "./email.server";
import { sendSlackExportNotification } from "./slack.server";
import { decrypt } from "../utils/encryption.server";

function scheduleLabel(schedule) {
  if (schedule.frequency === "daily") return `Daily at ${schedule.hour}:00 UTC`;
  if (schedule.frequency === "weekly") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `Weekly ${days[schedule.dayOfWeek ?? 1]} at ${schedule.hour}:00 UTC`;
  }
  if (schedule.frequency === "monthly") return `Monthly at ${schedule.hour}:00 UTC`;
  return schedule.frequency;
}

export async function runDueSchedules() {
  const now = new Date();

  const dueSchedules = await db.scheduledExport.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
    },
    include: { shop: true },
  });

  const results = [];

  for (const schedule of dueSchedules) {
    try {
      const result = await executeScheduledExport(schedule);
      results.push({ scheduleId: schedule.id, success: true, ...result });
    } catch (error) {
      console.error(`Scheduled export ${schedule.id} failed:`, error.message);
      results.push({ scheduleId: schedule.id, success: false, error: error.message });
    }
  }

  return { processed: results.length, results };
}

async function executeScheduledExport(schedule) {
  // Plan downgrades don't auto-delete schedules — a merchant on Free may still
  // have a Growth-era schedule on the books. Re-check the cached plan tier and
  // skip when their plan no longer allows the schedule. We advance nextRunAt
  // anyway so the scheduler doesn't tight-loop on a permanently-blocked job.
  const planLimits = getPlanLimits(schedule.shop.plan);
  const skipReason = !planLimits.allowSchedules
    ? "scheduled exports not on current plan"
    : !planLimits.formats.includes(schedule.format)
      ? `${schedule.format} format not on current plan`
      : schedule.deliveryMethod === "slack" && !planLimits.allowSlackDelivery
        ? "Slack delivery not on current plan"
        : null;

  if (skipReason) {
    const nextRunAt = computeNextRun(schedule);
    await db.scheduledExport.update({
      where: { id: schedule.id },
      data: { lastRunAt: now(), nextRunAt },
    });
    console.warn(
      `Skipped scheduled export ${schedule.id} for shop ${schedule.shopId}: ${skipReason}`,
    );
    return { skipped: true, reason: skipReason, nextRunAt };
  }

  const job = await db.exportJob.create({
    data: {
      shopId: schedule.shopId,
      format: schedule.format,
      filtersJson: schedule.filtersJson || undefined,
      status: "queued",
      scheduleId: schedule.id,
    },
  });

  const exportResult = await processExport(job.id);

  const updatedJob = await db.exportJob.findUnique({ where: { id: job.id } });

  if (
    schedule.deliveryMethod === "email" &&
    schedule.email &&
    updatedJob.filePath &&
    updatedJob.fileContent
  ) {
    await sendExportEmail({
      to: schedule.email,
      shopDomain: schedule.shop.shopDomain,
      filename: updatedJob.filePath,
      fileBuffer: Buffer.from(updatedJob.fileContent),
      rowCount: updatedJob.rowCount || 0,
      format: schedule.format,
    });
  }

  if (
    schedule.deliveryMethod === "slack" &&
    schedule.slackWebhookUrlEnc &&
    updatedJob.filePath
  ) {
    try {
      const webhookUrl = decrypt(schedule.slackWebhookUrlEnc);
      await sendSlackExportNotification({
        webhookUrl,
        shopDomain: schedule.shop.shopDomain,
        format: schedule.format,
        rowCount: updatedJob.rowCount || 0,
        filePath: updatedJob.filePath,
        scheduleLabel: scheduleLabel(schedule),
      });
    } catch (err) {
      console.error(`Slack delivery failed for schedule ${schedule.id}:`, err.message);
    }
  }

  const nextRunAt = computeNextRun(schedule);
  await db.scheduledExport.update({
    where: { id: schedule.id },
    data: {
      lastRunAt: now(),
      nextRunAt,
    },
  });

  return { jobId: job.id, rowCount: updatedJob.rowCount, nextRunAt };
}

function now() {
  return new Date();
}

export function computeNextRun(schedule) {
  const base = new Date();

  if (schedule.frequency === "daily") {
    const next = new Date(base);
    next.setDate(next.getDate() + 1);
    next.setHours(schedule.hour, 0, 0, 0);
    return next;
  }

  if (schedule.frequency === "weekly") {
    const next = new Date(base);
    const currentDay = next.getDay();
    const targetDay = schedule.dayOfWeek ?? 1;
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    next.setDate(next.getDate() + daysUntil);
    next.setHours(schedule.hour, 0, 0, 0);
    return next;
  }

  if (schedule.frequency === "monthly") {
    const next = new Date(base);
    next.setMonth(next.getMonth() + 1);
    next.setDate(1);
    next.setHours(schedule.hour, 0, 0, 0);
    return next;
  }

  const fallback = new Date(base);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(schedule.hour, 0, 0, 0);
  return fallback;
}

export function computeFirstRun(frequency, dayOfWeek, hour) {
  const base = new Date();

  if (frequency === "daily") {
    const next = new Date(base);
    if (base.getHours() >= hour) {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(hour, 0, 0, 0);
    return next;
  }

  if (frequency === "weekly") {
    const next = new Date(base);
    const currentDay = next.getDay();
    const targetDay = dayOfWeek ?? 1;
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && base.getHours() >= hour)) {
      daysUntil += 7;
    }
    next.setDate(next.getDate() + daysUntil);
    next.setHours(hour, 0, 0, 0);
    return next;
  }

  if (frequency === "monthly") {
    const next = new Date(base);
    if (base.getDate() > 1 || (base.getDate() === 1 && base.getHours() >= hour)) {
      next.setMonth(next.getMonth() + 1);
    }
    next.setDate(1);
    next.setHours(hour, 0, 0, 0);
    return next;
  }

  const fallback = new Date(base);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(hour, 0, 0, 0);
  return fallback;
}
