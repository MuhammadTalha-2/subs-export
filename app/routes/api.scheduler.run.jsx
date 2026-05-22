import { runDueSchedules } from "../services/scheduler.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expectedToken = process.env.SCHEDULER_SECRET;
  if (!expectedToken) {
    return new Response("Scheduler not configured", { status: 503 });
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${expectedToken}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runDueSchedules();
    return Response.json(result);
  } catch (error) {
    console.error("Scheduler run failed:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};
