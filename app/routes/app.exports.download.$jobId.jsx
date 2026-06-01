import { authenticate } from "../shopify.server";
import { ensureShop } from "../utils/shop.server";
import db from "../db.server";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  // Scope the lookup to the authenticated shop so a merchant can never download
  // another shop's export by guessing a job id.
  const job = await db.exportJob.findFirst({
    where: { id: params.jobId, shopId: shop.id },
    select: { filePath: true, fileContent: true, format: true },
  });

  if (!job || !job.filePath) {
    throw new Response("Export not found", { status: 404 });
  }

  if (!job.fileContent) {
    throw new Response("File no longer available", { status: 410 });
  }

  const fileBuffer = Buffer.from(job.fileContent);
  const contentType =
    job.format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv; charset=utf-8";

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${job.filePath}"`,
      "Content-Length": String(fileBuffer.length),
    },
  });
};
