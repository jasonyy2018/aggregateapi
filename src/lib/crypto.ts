import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

/**
 * AES-256-GCM symmetric encryption for provider API keys.
 *
 * Storage format (base64):
 *   [12 bytes IV][16 bytes auth tag][N bytes ciphertext]
 *
 * The encryption key is derived from the ENCRYPTION_KEY env var via SHA-256,
 * so any non-empty secret works (it will be normalized to 32 bytes).
 *
 * If ENCRYPTION_KEY is not set, a warning is logged and a development-only
 * fallback derived from NEXTAUTH_SECRET is used so local dev doesn't break.
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const secret = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "Missing ENCRYPTION_KEY (or NEXTAUTH_SECRET) env var. " +
        "Set ENCRYPTION_KEY to a strong random string to enable provider API key encryption."
    );
  }
  if (!process.env.ENCRYPTION_KEY) {
    // eslint-disable-next-line no-console
    console.warn(
      "[crypto] ENCRYPTION_KEY not set, falling back to NEXTAUTH_SECRET. " +
        "Configure ENCRYPTION_KEY for production."
    );
  }
  cachedKey = createHash("sha256").update(secret).digest();
  return cachedKey;
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(ciphertext: string): string {
  if (!ciphertext) return "";
  const key = getKey();
  const buf = Buffer.from(ciphertext, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("Invalid ciphertext");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Returns a short hint like "sk-****abcd" from the raw key for admin UI display. */
export function makeKeyHint(raw: string): string {
  if (!raw) return "";
  const tail = raw.slice(-4);
  const prefix = raw.slice(0, Math.min(3, raw.length - 4));
  return `${prefix}${"*".repeat(Math.max(4, Math.min(8, raw.length - 7)))}${tail}`;
}
