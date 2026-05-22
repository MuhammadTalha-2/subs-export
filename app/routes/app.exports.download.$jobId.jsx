import { readFile } from "fs/promises";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../utils/shop.server";
import db from "../db.server";
import { getExportFilePath } from "../services/export.server";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  const job = await db.exportJob.findFirst({
    where: { id: params.jobId, shopId: shop.id },
  });

  if (!job || !job.filePath) {
    throw new Response("Export not found", { status: 404 });
  }

  const fullPath = await getExportFilePath(job.filePath);
  if (!fullPath) {
    throw new Response("File no longer available", { status: 410 });
  }

  const fileBuffer = await readFile(fullPath);
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
