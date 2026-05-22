import { google } from "googleapis";
import db from "../db.server";
import { encrypt, decrypt } from "../utils/encryption.server";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.SHOPIFY_APP_URL}/auth/google/callback`,
  );
}

export function getGoogleAuthUrl(shopDomain) {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: shopDomain,
  });
}

export async function exchangeCodeForTokens(code) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function saveGoogleTokens(shopId, tokens, email) {
  await db.googleAuth.upsert({
    where: { shopId },
    update: {
      accessTokenEnc: encrypt(tokens.access_token),
      refreshTokenEnc: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(tokens.expiry_date),
      googleEmail: email || null,
    },
    create: {
      shopId,
      accessTokenEnc: encrypt(tokens.access_token),
      refreshTokenEnc: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(tokens.expiry_date),
      googleEmail: email || null,
    },
  });
}

export async function getAuthenticatedClient(shopId) {
  const auth = await db.googleAuth.findUnique({ where: { shopId } });
  if (!auth) return null;

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: decrypt(auth.accessTokenEnc),
    refresh_token: decrypt(auth.refreshTokenEnc),
    expiry_date: auth.tokenExpiresAt.getTime(),
  });

  client.on("tokens", async (newTokens) => {
    const updateData = {
      accessTokenEnc: encrypt(newTokens.access_token),
      tokenExpiresAt: new Date(newTokens.expiry_date),
    };
    if (newTokens.refresh_token) {
      updateData.refreshTokenEnc = encrypt(newTokens.refresh_token);
    }
    await db.googleAuth.update({ where: { shopId }, data: updateData });
  });

  return client;
}

export async function getGoogleAuthStatus(shopId) {
  const auth = await db.googleAuth.findUnique({ where: { shopId } });
  if (!auth) return { connected: false };
  return {
    connected: true,
    email: auth.googleEmail,
    expiresAt: auth.tokenExpiresAt,
  };
}

export async function disconnectGoogle(shopId) {
  await db.googleAuth.deleteMany({ where: { shopId } });
}

export async function getGoogleUserEmail(tokens) {
  const client = getOAuth2Client();
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  return data.email;
}
