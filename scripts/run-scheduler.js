/**
 * Standalone scheduler worker.
 *
 * Usage:
 *   One-shot (for cron):  node scripts/run-scheduler.js
 *   Loop (for VPS):       node scripts/run-scheduler.js --loop
 *
 * When deployed to a VPS, run this as a systemd service with --loop.
 * For development, call the API endpoint instead:
 *   curl -X POST http://localhost:3000/api/scheduler/run
 */

const INTERVAL_MS = 60 * 1000; // check every minute

async function tick(appUrl, secret) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (secret) headers["Authorization"] = `Bearer ${secret}`;

    const res = await fetch(`${appUrl}/api/scheduler/run`, {
      method: "POST",
      headers,
    });

    const data = await res.json();
    const timestamp = new Date().toISOString();

    if (data.processed > 0) {
      console.log(`[${timestamp}] Processed ${data.processed} scheduled export(s)`);
      for (const r of data.results) {
        if (r.success) {
          console.log(`  ✓ ${r.scheduleId} — ${r.rowCount} rows`);
        } else {
          console.log(`  ✗ ${r.scheduleId} — ${r.error}`);
        }
      }
    } else {
      console.log(`[${timestamp}] No due schedules`);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Scheduler error:`, err.message);
  }
}

async function main() {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const secret = process.env.SCHEDULER_SECRET || "";
  const loop = process.argv.includes("--loop");

  console.log(`Scheduler worker started (mode: ${loop ? "loop" : "one-shot"})`);
  console.log(`Target: ${appUrl}/api/scheduler/run`);

  await tick(appUrl, secret);

  if (loop) {
    setInterval(() => tick(appUrl, secret), INTERVAL_MS);
  }
}

main();
