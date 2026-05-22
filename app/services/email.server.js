import { Resend } from "resend";
import { readFile } from "fs/promises";

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || "SubsExport <exports@subsexport.com>";

export async function sendExportEmail({ to, shopDomain, filename, filePath, rowCount, format }) {
  const fileBuffer = await readFile(filePath);
  const shop = shopDomain.replace(".myshopify.com", "");

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject: `Your SubsExport file is ready — ${shop}`,
    html: buildEmailHtml({ shop, filename, rowCount, format }),
    attachments: [
      {
        filename,
        content: fileBuffer.toString("base64"),
        contentType: format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv",
      },
    ],
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}

function buildEmailHtml({ shop, filename, rowCount, format }) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a; margin-bottom: 16px;">Your export is ready</h2>
      <p style="color: #616161; font-size: 15px; line-height: 1.5;">
        Your scheduled subscription data export for <strong>${shop}</strong> has been completed.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-size: 14px; color: #616161;">File</td>
          <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-size: 14px;">${filename}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-size: 14px; color: #616161;">Format</td>
          <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-size: 14px;">${format.toUpperCase()}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-size: 14px; color: #616161;">Rows</td>
          <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-size: 14px;">${rowCount.toLocaleString()}</td>
        </tr>
      </table>
      <p style="color: #616161; font-size: 14px;">
        The export file is attached to this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
      <p style="color: #9e9e9e; font-size: 12px;">
        Sent by SubsExport. You can manage your scheduled exports from the app settings.
      </p>
    </div>
  `;
}
