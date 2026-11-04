import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return {
    enabled: vi.fn(),
    currentAdmin: vi.fn(),
    select,
    from,
    where,
    limit,
    read: vi.fn(),
  };
});

vi.mock("@/server/db", () => ({
  isMySqlCatalogueEnabled: mocks.enabled,
  getMySqlDb: () => ({ select: mocks.select }),
}));
vi.mock("@/server/auth/local-admin", () => ({
  getCurrentLocalAdmin: mocks.currentAdmin,
}));
vi.mock("@/server/db/schema", () => ({
  productMedia: { id: "id", storageKey: "storageKey" },
}));
vi.mock("@/server/media/product-storage", () => ({
  safeProductStorageKey: (key: string) => {
    const parts = key.split("/");
    if (parts.length !== 3 || parts[0] !== "products" || !/^[0-9a-f-]{36}$/i.test(parts[1])
      || !/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$/i.test(parts[2])) {
      throw new Error("Invalid product media key");
    }
    return key;
  },
  readProductMedia: mocks.read,
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({ operator: "eq" })),
}));

import { NextRequest } from "next/server";
import { GET } from "./route";

const productId = "a8f9df07-6f01-4f8b-a74d-90d49db01852";
const imageId = "b8f9df07-6f01-4f8b-a74d-90d49db01852";
const key = "products/" + productId + "/" + imageId + ".jpg";

function request() {
  return new NextRequest("https://gallery.example/api/admin/product-media/" + key);
}

function params(value = key) {
  return Promise.resolve({ key: value.split("/") });
}

describe("GET /api/admin/product-media/[...key]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.mockReturnValue(true);
    mocks.currentAdmin.mockResolvedValue({
      id: "owner-1",
      email: "owner@example.test",
      displayName: "Gallery Owner",
      role: "owner",
    });
    mocks.limit.mockResolvedValue([{ id: imageId }]);
    mocks.read.mockResolvedValue({
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0x01]),
      mimeType: "image/jpeg",
    });
  });

  it("does not expose admin media when MySQL catalogue mode is disabled", async () => {
    mocks.enabled.mockReturnValue(false);
    const response = await GET(request(), { params: params() });
    expect(response.status).toBe(404);
    expect(mocks.currentAdmin).not.toHaveBeenCalled();
  });

  it("requires an active owner/admin session", async () => {
    mocks.currentAdmin.mockResolvedValue(null);
    const response = await GET(request(), { params: params() });
    expect(response.status).toBe(401);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("does not serve a storage key that has no product-media database record", async () => {
    mocks.limit.mockResolvedValue([]);
    const response = await GET(request(), { params: params() });
    expect(response.status).toBe(404);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("serves attached draft media privately to an authenticated administrator", async () => {
    const response = await GET(request(), { params: params() });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 0x01]));
  });

  it("returns a private no-store response when the stored asset is missing", async () => {
    mocks.read.mockResolvedValue(null);
    const response = await GET(request(), { params: params() });
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects malformed keys without attempting database or storage access", async () => {
    const response = await GET(request(), { params: params("products/../secret.jpg") });
    expect(response.status).toBe(404);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
