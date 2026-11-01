import { describe, expect, it } from "vitest";
import { hasSupportedImageSignature } from "./image-signature";

const ascii = (value: string) => new TextEncoder().encode(value);

describe("supported image signatures", () => {
  it("accepts JPEG, PNG and WebP signatures", () => {
    expect(hasSupportedImageSignature("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe(true);
    expect(hasSupportedImageSignature("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasSupportedImageSignature("image/webp", ascii("RIFF0000WEBPVP8 "))).toBe(true);
  });

  it("accepts AVIF and AVIS ISO-BMFF brands", () => {
    expect(hasSupportedImageSignature("image/avif", ascii("0000ftypavif0000"))).toBe(true);
    expect(hasSupportedImageSignature("image/avif", ascii("0000ftypmif10000avis"))).toBe(true);
  });

  it("rejects spoofed MIME types and unsupported formats", () => {
    expect(hasSupportedImageSignature("image/png", ascii("<svg></svg>"))).toBe(false);
    expect(hasSupportedImageSignature("image/jpeg", ascii("not an image"))).toBe(false);
    expect(hasSupportedImageSignature("image/svg+xml", ascii("<svg></svg>"))).toBe(false);
  });

  it("rejects truncated container signatures", () => {
    expect(hasSupportedImageSignature("image/webp", ascii("RIFF0000"))).toBe(false);
    expect(hasSupportedImageSignature("image/avif", ascii("0000ftyp"))).toBe(false);
  });
});
