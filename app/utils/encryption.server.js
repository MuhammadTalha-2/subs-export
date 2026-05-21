import { createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-cbc";

function getKeyAndIv() {
  const key = Buffer.from(process.env.AES_ENCRYPTION_KEY, "hex");
  const iv = Buffer.from(process.env.AES_ENCRYPTION_IV, "hex");
  return { key, iv };
}

export function encrypt(text) {
  if (!text) return null;
  const { key, iv } = getKeyAndIv();
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

export function decrypt(encryptedText) {
  if (!encryptedText) return null;
  const { key, iv } = getKeyAndIv();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
