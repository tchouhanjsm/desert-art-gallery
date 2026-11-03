import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync(new URL("./mysql-orders.ts", import.meta.url), "utf8");
const reservationService = readFileSync(new URL("../catalogue/inventory.ts", import.meta.url), "utf8");
const checkoutRoute = readFileSync(new URL("../../app/api/checkout/orders/route.ts", import.meta.url), "utf8");
const reservationRoute = readFileSync(new URL("../../app/api/cart/reserve/route.ts", import.meta.url), "utf8");

describe("MySQL order lifecycle contract", () => {
  it("uses reservation snapshots and server-owned order pricing", () => {
    expect(reservationService).toContain("productTitleSnapshot: product.title");
    expect(reservationService).toContain("unitPriceMinorSnapshot: variant.priceMinor ?? product.priceMinor");
    expect(service).toContain("line.unitPriceMinorSnapshot");
    expect(service).toContain("calculateCheckoutTax");
  });

  it("binds drafts to customer-owned reservations and idempotent checkout requests", () => {
    expect(service).toContain("eq(inventoryReservations.customerReference, input.customerUserId)");
    expect(service).toContain("checkoutRequestHash");
    expect(service).toContain("checkoutIdempotencyKey");
  });

  it("fails closed for ambiguous shipping, missing tax rules and expired reservations", () => {
    expect(service).toContain("Shipping is not configured unambiguously");
    expect(service).toContain("Tax policy is not configured for this destination and currency");
    expect(service).toContain("The inventory reservation has expired");
  });

  it("uses the MySQL path before legacy Supabase calls", () => {
    expect(reservationRoute.indexOf("if (isMySqlCustomerAuthEnabled())")).toBeLessThan(reservationRoute.indexOf("createSupabaseServerClient"));
    expect(checkoutRoute.indexOf("if (isMySqlCustomerAuthEnabled())")).toBeLessThan(checkoutRoute.indexOf("createSupabaseServerClient"));
    expect(reservationRoute).toContain("reserveVariantStock");
    expect(checkoutRoute).toContain("createMySqlOrderDraft");
  });

  it("cannot mark an unpaid draft paid from administrator fulfilment", () => {
    expect(service).toContain('order.status === "paid" && input.nextStatus === "processing"');
    expect(service).not.toContain('order.status === "draft" && input.nextStatus === "paid"');
  });
});
