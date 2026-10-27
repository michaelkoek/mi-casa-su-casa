import { createVerify, generateKeyPairSync, randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { bankJwt, decrypt, encrypt, stableId } = await import("./crypto");

const key = randomBytes(32).toString("base64");

describe("encrypt / decrypt", () => {
  it("round-trips and uses a fresh iv each time", () => {
    const a = encrypt("session-123", key);
    const b = encrypt("session-123", key);
    expect(a).not.toBe(b);
    expect(a).not.toContain("session-123");
    expect(decrypt(a, key)).toBe("session-123");
  });
  it("rejects a tampered ciphertext", () => {
    const sealed = encrypt("session-123", key);
    const parts = sealed.split(".");
    parts[3] = Buffer.from("other").toString("base64url");
    expect(() => decrypt(parts.join("."), key)).toThrow();
  });
  it("rejects the wrong key", () => {
    expect(() => decrypt(encrypt("x", key), randomBytes(32).toString("base64"))).toThrow();
  });
  it("rejects a key that is not 32 bytes", () => {
    expect(() => encrypt("x", randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });
});

describe("stableId", () => {
  it("is deterministic and fits the sync id format", () => {
    const id = stableId("b", "acc:entry-1");
    expect(id).toBe(stableId("b", "acc:entry-1"));
    expect(id).not.toBe(stableId("b", "acc:entry-2"));
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });
});

describe("bankJwt", () => {
  it("is an RS256 token with the claims Enable Banking expects", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const now = new Date("2026-10-27T12:00:00Z");
    const jwt = bankJwt("app-id", pem, now);
    const [head, body, sig] = jwt.split(".");
    expect(JSON.parse(Buffer.from(head, "base64url").toString())).toEqual({ typ: "JWT", alg: "RS256", kid: "app-id" });
    const claims = JSON.parse(Buffer.from(body, "base64url").toString());
    expect(claims).toMatchObject({ iss: "enablebanking.com", aud: "api.enablebanking.com" });
    expect(claims.exp - claims.iat).toBe(3600);
    const ok = createVerify("RSA-SHA256").update(`${head}.${body}`).verify(publicKey, sig, "base64url");
    expect(ok).toBe(true);
  });
});
