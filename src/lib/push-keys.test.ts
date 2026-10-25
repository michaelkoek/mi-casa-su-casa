import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array } from "./push-keys";

// A real VAPID public key: an uncompressed P-256 point (65 bytes, first byte 0x04).
const KEY = "BGDGlMwweBPXDLigSUYKU81H-330wv7AvoLBHyl9ISrRnoICvNGUSKo4P7jgIRtLUCqTM9RUpC6N-RAqMrG7-NQ";

describe("urlBase64ToUint8Array", () => {
  it("decodes a VAPID public key to 65 bytes starting with 0x04", () => {
    const bytes = urlBase64ToUint8Array(KEY);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });

  it("handles url-safe characters and missing padding", () => {
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([251, 255]);
  });
});
