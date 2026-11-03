import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({
  isMySqlCatalogueEnabled: vi.fn(),
}));
vi.mock("@/server/catalogue/inventory", () => ({
  expireVariantStockReservations: vi.fn(),
}));

import { isMySqlCatalogueEnabled } from "@/server/db";
import { expireVariantStockReservations } from "@/server/catalogue/inventory";
import { POST } from "./route";

const catalogueEnabled = vi.mocked(isMySqlCatalogueEnabled);
const expireReservations = vi.mocked(expireVariantStockReservations);
const validSecret = "integration-cron-secret-" + "x".repeat(32);

function request(authorization?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/cron/expire-mysql-reservations", {
    method: "POST",
    ...(authorization ? { headers: { authorization } } : {}),
  });
}

describe("MySQL reservation expiry endpoint", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("INVENTORY_EXPIRY_CRON_SECRET", validSecret);
    catalogueEnabled.mockReturnValue(true);
    expireReservations.mockResolvedValue(4);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects missing, malformed, short-secret and incorrect bearer credentials", async () => {
    const attempts = [
      request(),
      request("Basic " + validSecret),
      request("Bearer wrong-secret"),
    ];
    for (const attempt of attempts) {
      const response = await POST(attempt);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized." });
    }

    vi.stubEnv("INVENTORY_EXPIRY_CRON_SECRET", "too-short");
    const shortConfiguredSecret = await POST(request("Bearer too-short"));
    expect(shortConfiguredSecret.status).toBe(401);
    expect(expireReservations).not.toHaveBeenCalled();
  });

  it("does not run expiry when MySQL catalogue mode is disabled", async () => {
    catalogueEnabled.mockReturnValue(false);
    const response = await POST(request("Bearer " + validSecret));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "MySQL catalogue mode is not enabled." });
    expect(expireReservations).not.toHaveBeenCalled();
  });

  it("runs a bounded expiry batch for a valid bearer credential", async () => {
    const response = await POST(request("Bearer " + validSecret));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, expired: 4 });
    expect(expireReservations).toHaveBeenCalledTimes(1);
    expect(expireReservations).toHaveBeenCalledWith(250);
  });

  it("returns a safe service error when the expiry batch fails", async () => {
    expireReservations.mockRejectedValue(new Error("private database detail"));
    const response = await POST(request("Bearer " + validSecret));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ error: "Reservation expiry could not be completed." });
    expect(JSON.stringify(body)).not.toContain("private database detail");
  });
});
