import { google } from "googleapis";
import { getAuthenticatedClient } from "./google-auth.server";
import { UNIFIED_FIELDS } from "../utils/unified-schema";

export async function pushToGoogleSheets(shopId, rows, filters, shopDomain) {
  const auth = await getAuthenticatedClient(shopId);
  if (!auth) {
    throw new Error("Google account not connected. Please connect Google Sheets in Settings.");
  }

  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });

  const shop = shopDomain.replace(".myshopify.com", "");
  const date = new Date().toISOString().split("T")[0];
  const title = `SubsExport — ${shop} — ${date}`;

  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { title: "Subscriptions" } },
        { properties: { title: "Export Info" } },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;
  const spreadsheetUrl = spreadsheet.data.spreadsheetUrl;

  const fields = UNIFIED_FIELDS;
  const headerRow = fields.map((f) => f.label);
  const dataRows = rows.map((row) =>
    fields.map((f) => {
      const val = row[f.key];
      if (val === null || val === undefined) return "";
      return val;
    }),
  );

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Subscriptions!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [headerRow, ...dataRows],
    },
  });

  const infoRows = [
    ["Property", "Value"],
    ["Export Date", new Date().toISOString()],
    ["Total Rows", rows.length],
    ["Fields Exported", fields.length],
  ];
  if (filters?.status?.length) {
    infoRows.push(["Status Filter", filters.status.join(", ")]);
  }
  if (filters?.product) {
    infoRows.push(["Product Filter", filters.product]);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Export Info!A1",
    valueInputOption: "RAW",
    requestBody: { values: infoRows },
  });

  await formatSheet(sheets, spreadsheetId);

  return { spreadsheetId, spreadsheetUrl };
}

async function formatSheet(sheets, spreadsheetId) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const subsSheet = spreadsheet.data.sheets.find(
    (s) => s.properties.title === "Subscriptions",
  );
  const infoSheet = spreadsheet.data.sheets.find(
    (s) => s.properties.title === "Export Info",
  );

  const requests = [];

  if (subsSheet) {
    requests.push({
      repeatCell: {
        range: {
          sheetId: subsSheet.properties.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.91, green: 0.91, blue: 0.91 },
            textFormat: { bold: true },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
      },
    });

    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: subsSheet.properties.sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: "gridProperties.frozenRowCount",
      },
    });
  }

  if (infoSheet) {
    requests.push({
      repeatCell: {
        range: {
          sheetId: infoSheet.properties.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
          },
        },
        fields: "userEnteredFormat(textFormat)",
      },
    });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }
}
