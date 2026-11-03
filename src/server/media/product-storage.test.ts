import { describe, expect, it } from "vitest";
import {
  createDeterministicProductStorageKey,
  safeProductStorageKey,
} from "./product-storage";

describe("deterministic product media storage keys", () => {
  const productId = "a8f9df07-6f01-4f8b-a74d-90d49db01852";
  const digest = "a".repeat(64);

  it("returns a stable, path-safe key for the same product image", () => {
    const first = createDeterministicProductStorageKey(productId, digest, "image/jpeg");
    const second = createDeterministicProductStorageKey(productId, digest, "image/jpeg");
    expect(first).toBe(second);
    expect(first).toMatch(/^products\\/[0-9a-f-]{36}\\/[0-9a-f-]{8}-[0-9a-f-]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.jpg$/i);
    expect(safeProductStorageKey(first)).toBe(first);
  });

  it("separates products and rejects malformed digests", () => {
    const first = createDeterministicProductStorageKey(productId, digest, "image/png");
    const second = createDeterministicProductStorageKey("b8f9df07-6f01-4f8b-a74d-90d49db01852", digest, "image/png");
    expect(first).not.toBe(second);
    expect(() => createDeterministicProductStorageKey(productId, "bad", "image/png")).toThrow();
  });
});
