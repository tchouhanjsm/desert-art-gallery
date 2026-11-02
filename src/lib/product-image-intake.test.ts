import { describe, expect, it } from "vitest";
import {
  MAX_PRODUCT_IMAGE_BYTES,
  detectProductImageMime,
  parseProductImageName,
  validateProductImageBytes,
} from "./product-image-intake";

describe("private product image intake", () => {
  it("parses product-slug image sequence names", () => {
    expect(parseProductImageName("01-primary.jpg")).toEqual({
      sequence: 1, role: "primary", extension: "jpg",
    });
    expect(parseProductImageName("02-detail.webp")).toEqual({
      sequence: 2, role: "detail", extension: "webp",
    });
  });

  it.each([
    "../01-primary.jpg",
    "01-front.jpg",
    "00-detail.jpg",
    "02-primary.jpg",
    "100-detail.jpg",
    "01-primary.svg",
    ".DS_Store",
  ])("rejects an unsupported intake filename: %s", (filename) => {
    expect(parseProductImageName(filename)).toBeNull();
  });

  it("detects supported file signatures", () => {
    expect(detectProductImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(detectProductImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectProductImageMime(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
    expect(detectProductImageMime(Uint8Array.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]))).toBe("image/avif");
    expect(detectProductImageMime(Uint8Array.from([0, 1, 2]))).toBeNull();
  });

  it("rejects extensions that disagree with the real file signature", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateProductImageBytes("01-primary.jpg", png)).toEqual({
      valid: false,
      reason: "File extension does not match the detected image format.",
    });
    expect(validateProductImageBytes("01-primary.png", png)).toEqual({
      valid: true,
      mimeType: "image/png",
    });
  });

  it("rejects oversized files before requiring image-signature parsing", () => {
    const oversized = new Uint8Array(MAX_PRODUCT_IMAGE_BYTES + 1);
    expect(validateProductImageBytes("01-primary.jpg", oversized)).toEqual({
      valid: false,
      reason: "Image exceeds the 12 MB upload limit.",
    });
  });
});
