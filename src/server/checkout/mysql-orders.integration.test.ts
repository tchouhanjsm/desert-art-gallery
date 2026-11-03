import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { closeMySqlPool, getMySqlDb } from "../db";
import {
  releaseVariantStockReservation,
  reserveVariantStock,
} from "../catalogue/inventory";
import {
  createMySqlOrderDraft,
  getMySqlAdminOrder,
  getMySqlCustomerOrder,
  transitionMySqlOrderFulfilment,
} from "./mysql-orders";
import {
  checkoutTaxRules,
  customerUsers,
  inventoryReservationItems,
  inventoryReservations,
  orderEvents,
  orderItems,
  orders,
  productVariants,
  products,
  shippingRates,
  shippingZones,
} from "../db/schema";

const enabled = process.env.MYSQL_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite("MySQL Phase 7 order checkout acceptance", () => {
  afterAll(async () => {
    await closeMySqlPool();
  });

  it("creates customer-owned drafts, replays idempotently, isolates order reads and cancels on reservation release", async () => {
    const db = getMySqlDb();
    const customerId = randomUUID();
    const otherCustomerId = randomUUID();
    const productId = randomUUID();
    const variantId = randomUUID();
    const zoneId = randomUUID();
    const rateId = randomUUID();
    const taxRuleId = randomUUID();
    const customerEmail = "checkout-" + customerId + "@example.test";
    const otherEmail = "checkout-other-" + otherCustomerId + "@example.test";
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    const reservationKey = "checkout-reservation-" + randomUUID();
    const checkoutKey = randomUUID();
    let reservationId: string | null = null;
    let orderId: string | null = null;

    try {
      await db.insert(customerUsers).values([
        {
          id: customerId,
          email: customerEmail,
          displayName: "Checkout Customer",
          phone: "",
          passwordHash: "scrypt$" + "a".repeat(32) + "$" + "b".repeat(128),
          isActive: true,
          failedLoginCount: 0,
        },
        {
          id: otherCustomerId,
          email: otherEmail,
          displayName: "Other Customer",
          phone: "",
          passwordHash: "scrypt$" + "c".repeat(32) + "$" + "d".repeat(128),
          isActive: true,
          failedLoginCount: 0,
        },
      ]);
      await db.insert(products).values({
        id: productId,
        title: "Integration checkout textile",
        slug: "checkout-integration-" + productId,
        currency: "USD",
        priceMinor: 1250,
        status: "published",
        isOneOfAKind: false,
      });
      await db.insert(productVariants).values({
        id: variantId,
        productId,
        sku: "CHECKOUT-" + productId.slice(0, 8),
        label: "Standard",
        attributes: { size: "One size" },
        currency: "USD",
        stockQuantity: 1,
        isActive: true,
      });
      await db.insert(shippingZones).values({
        id: zoneId,
        name: "Integration zone " + zoneId.slice(0, 8),
        countryCodes: ["IN"],
        isActive: true,
      });
      await db.insert(shippingRates).values({
        id: rateId,
        zoneId,
        name: "Integration tracked shipping",
        currency: "USD",
        amountMinor: 200,
        minDeliveryDays: 3,
        maxDeliveryDays: 7,
        dutiesDisclosure: "Integration fixture only; no live delivery promise.",
        isActive: true,
      });
      await db.insert(checkoutTaxRules).values({
        id: taxRuleId,
        countryCode: "IN",
        currency: "USD",
        taxName: "Integration explicit zero rate",
        rateBasisPoints: 0,
        taxableShipping: false,
        disclosure: "Integration fixture only; zero-rate test rule.",
        isActive: true,
      });

      const reservation = await reserveVariantStock({
        customerReference: customerId,
        idempotencyKey: reservationKey,
        items: [{ variantId, quantity: 1 }],
        expiresAt,
      }, now);
      reservationId = reservation.reservationId;
      expect(reservation.status).toBe("reserved");

      const checkoutInput = {
        customerUserId: customerId,
        reservationId,
        shippingRateId: rateId,
        shippingAddress: {
          recipient_name: "Integration Recipient",
          address_line_1: "12 Fort Road",
          address_line_2: "",
          city: "Jaisalmer",
          region: "Rajasthan",
          postal_code: "345001",
          country_code: "IN",
          phone: "+91 9876543210",
        },
        customerNote: null,
        idempotencyKey: checkoutKey,
        now,
      };

      const created = await createMySqlOrderDraft(checkoutInput);
      orderId = created.orderId;
      expect(created.status).toBe("draft");
      expect(created.replayed).toBe(false);
      expect(created.subtotalMinor).toBe(1250);
      expect(created.shippingMinor).toBe(200);
      expect(created.taxMinor).toBe(0);
      expect(created.totalMinor).toBe(1450);

      const replay = await createMySqlOrderDraft(checkoutInput);
      expect(replay.orderId).toBe(created.orderId);
      expect(replay.replayed).toBe(true);

      await expect(createMySqlOrderDraft({
        ...checkoutInput,
        customerNote: "Changed request payload",
      })).rejects.toThrow("different checkout request");

      const customerOrder = await getMySqlCustomerOrder(customerId, created.orderId);
      expect(customerOrder?.order.status).toBe("draft");
      expect(customerOrder?.items).toHaveLength(1);
      expect(customerOrder?.items[0]).toMatchObject({
        productTitle: "Integration checkout textile",
        variantLabel: "Standard",
        quantity: 1,
        unitPriceMinor: 1250,
        lineTotalMinor: 1250,
      });
      expect(await getMySqlCustomerOrder(otherCustomerId, created.orderId)).toBeNull();

      const adminOrder = await getMySqlAdminOrder(created.orderId);
      expect(adminOrder?.events).toHaveLength(1);
      expect(adminOrder?.events[0].eventType).toBe("order_draft_created");

      await expect(transitionMySqlOrderFulfilment({
        adminId: randomUUID(),
        orderId: created.orderId,
        nextStatus: "processing",
        carrier: null,
        trackingNumber: null,
        trackingUrl: null,
        now,
      })).rejects.toThrow("Only the preceding paid/fulfilment state can be advanced.");

      await releaseVariantStockReservation(reservationId, now);
      const [cancelledOrder] = await db.select().from(orders)
        .where(eq(orders.id, created.orderId)).limit(1);
      expect(cancelledOrder.status).toBe("cancelled");
      const updatedAdminOrder = await getMySqlAdminOrder(created.orderId);
      expect(updatedAdminOrder?.events.map((event) => event.eventType)).toEqual([
        "order_draft_created",
        "reservation_released",
      ]);
    } finally {
      if (orderId) {
        await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
        await db.delete(orderEvents).where(eq(orderEvents.orderId, orderId));
        await db.delete(orders).where(eq(orders.id, orderId));
      }
      if (reservationId) {
        await db.delete(inventoryReservationItems).where(eq(inventoryReservationItems.reservationId, reservationId));
        await db.delete(inventoryReservations).where(eq(inventoryReservations.id, reservationId));
      }
      await db.delete(shippingRates).where(eq(shippingRates.id, rateId));
      await db.delete(shippingZones).where(eq(shippingZones.id, zoneId));
      await db.delete(checkoutTaxRules).where(eq(checkoutTaxRules.id, taxRuleId));
      await db.delete(productVariants).where(eq(productVariants.id, variantId));
      await db.delete(products).where(eq(products.id, productId));
      await db.delete(customerUsers).where(inArray(customerUsers.id, [customerId, otherCustomerId]));
    }
  }, 60_000);
});
