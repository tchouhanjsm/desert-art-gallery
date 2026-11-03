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
    const [namespace, storedProductId, filename] = first.split("/");
    expect(namespace).toBe("products");
    expect(storedProductId).toBe(productId);
    expect(filename).toMatch(/^[0-9a-f-]{36}\\.jpg$/i);
    expect(safeProductStorageKey(first)).toBe(first);
  });

  it("separates products and rejects malformed digests", () => {
    const first = createDeterministicProductStorageKey(productId, digest, "image/png");
    const second = createDeterministicProductStorageKey("b8f9df07-6f01-4f8b-a74d-90d49db01852", digest, "image/png");
    expect(first).not.toBe(second);
    expect(() => createDeterministicProductStorageKey(productId, "bad", "image/png")).toThrow();
  });
});
