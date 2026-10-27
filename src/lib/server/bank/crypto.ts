import "server-only";
import { createCipheriv, createDecipheriv, createHash, createSign, randomBytes } from "node:crypto";

/*
 * Crypto for the bank link: session ids encrypted at rest (AES-256-GCM), stable ids
 * derived from bank identifiers, and the RS256 JWT Enable Banking expects.
 */

function keyBytes(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("BANK_TOKEN_KEY must be 32 bytes, base64");
  return key;
}

/** "v1.<iv>.<tag>.<ciphertext>", all base64url. */
export function encrypt(plain: string, base64Key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(base64Key), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decrypt(sealed: string, base64Key: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unknown ciphertext format");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(base64Key), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** Short, id-safe hash: same input, same id. */
export function stableId(prefix: string, input: string): string {
  return `${prefix}_${createHash("sha256").update(input).digest("base64url").slice(0, 32)}`;
}

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** JWT for the Enable Banking API, valid for one hour. */
export function bankJwt(appId: string, privateKeyPem: string, now = new Date()): string {
  const iat = Math.floor(now.getTime() / 1000);
  const head = b64url({ typ: "JWT", alg: "RS256", kid: appId });
  const body = b64url({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat, exp: iat + 3600 });
  const signature = createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKeyPem, "base64url");
  return `${head}.${body}.${signature}`;
}
