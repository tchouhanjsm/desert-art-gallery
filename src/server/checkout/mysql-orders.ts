import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { normalizeCountryCodes, parseCurrencyAmountToMinor, type CheckoutAddress } from "@/lib/checkout";
import { calculateCheckoutTax, calculateCheckoutTotal, getOrderDraftExpiry, toSafeOrderMinor } from "@/lib/order-checkout";
import { getMySqlDb } from "@/server/db";
import {
  checkoutTaxRules,
  customerUsers,
  inventoryReservationItems,
  inventoryReservations,
  orderEvents,
  orderItems,
  orders,
  shippingRates,
  shippingZones,
  type MySqlOrderStatus,
} from "@/server/db/schema";

const MAX_ORDER_MINOR = BigInt(Number.MAX_SAFE_INTEGER);
const DRAFT_LIFETIME_MS = 15 * 60 * 1000;

export type TaxSnapshot = { name: string; rate_basis_points: number; amount_minor: number };
export type OrderDraftResult = {
  orderId: string;
  orderNumber: string;
  status: MySqlOrderStatus;
  currency: string;
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  expiresAt: Date;
  replayed: boolean;
};

function safeMinor(value: number | null, label: string): bigint {
  if (value === null || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("The " + label + " snapshot is invalid.");
  }
  const amount = BigInt(value);
  if (amount > MAX_ORDER_MINOR) throw new Error("The " + label + " exceeds the supported amount.");
  return amount;
}

function safeNumber(value: bigint, label: string): number {
  return toSafeOrderMinor(value, label);
}

function requestHash(input: {
  reservationId: string;
  shippingRateId: string;
  shippingAddress: CheckoutAddress;
  customerNote: string | null;
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function orderDateStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? "";
  return part("year") + part("month") + part("day");
}

function resultFromOrder(order: typeof orders.$inferSelect, replayed: boolean): OrderDraftResult {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    subtotalMinor: order.subtotalMinor,
    shippingMinor: order.shippingMinor,
    taxMinor: order.taxMinor,
    totalMinor: order.totalMinor,
    expiresAt: order.expiresAt,
    replayed,
  };
}

export async function createMySqlOrderDraft(input: {
  customerUserId: string;
  reservationId: string;
  shippingRateId: string;
  shippingAddress: CheckoutAddress;
  customerNote: string | null;
  idempotencyKey: string;
  now?: Date;
}): Promise<OrderDraftResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.reservationId)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.shippingRateId)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey)) {
    throw new Error("A valid reservation, shipping rate and checkout idempotency key are required.");
  }
  if (input.customerNote !== null && (input.customerNote.length > 1000
    || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(input.customerNote))) {
    throw new Error("The delivery note is invalid or too long.");
  }

  const now = input.now ?? new Date();
  const countryCode = input.shippingAddress.country_code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("A valid delivery country is required.");
  const hash = requestHash({
    reservationId: input.reservationId,
    shippingRateId: input.shippingRateId,
    shippingAddress: input.shippingAddress,
    customerNote: input.customerNote,
  });
  const db = getMySqlDb();

  try {
    return await db.transaction(async (tx) => {
      // Lock order: reservation first, then its order. The release/expiry path uses the same order.
      const [reservation] = await tx.select().from(inventoryReservations)
        .where(and(
          eq(inventoryReservations.id, input.reservationId),
          eq(inventoryReservations.customerReference, input.customerUserId),
        ))
        .limit(1)
        .for("update");
      if (!reservation) throw new Error("The inventory reservation does not belong to this customer.");

      const [reservationOrder] = await tx.select().from(orders)
        .where(eq(orders.reservationId, reservation.id))
        .limit(1)
        .for("update");
      if (reservationOrder) {
        if (reservationOrder.customerUserId !== input.customerUserId || reservationOrder.checkoutRequestHash !== hash) {
          throw new Error("This reservation is already linked to a different checkout request.");
        }
        if (reservationOrder.status === "draft" && reservationOrder.expiresAt <= now) {
          if (reservation.status === "reserved") {
            await tx.update(inventoryReservations).set({ status: "expired" })
              .where(eq(inventoryReservations.id, reservation.id));
          }
          await tx.update(orders).set({ status: "expired", updatedAt: now })
            .where(eq(orders.id, reservationOrder.id));
          await tx.insert(orderEvents).values({
            id: randomUUID(),
            orderId: reservationOrder.id,
            actorType: "system",
            actorId: null,
            eventType: "reservation_expired",
            fromStatus: "draft",
            toStatus: "expired",
            note: "The unpaid checkout draft expired before payment was enabled.",
            createdAt: now,
          });
          const [expiredOrder] = await tx.select().from(orders)
            .where(eq(orders.id, reservationOrder.id)).limit(1);
          return resultFromOrder(expiredOrder, true);
        }
        return resultFromOrder(reservationOrder, true);
      }

      const [sameKey] = await tx.select().from(orders)
        .where(and(
          eq(orders.customerUserId, input.customerUserId),
          eq(orders.checkoutIdempotencyKey, input.idempotencyKey),
        ))
        .limit(1)
        .for("update");
      if (sameKey) {
        if (sameKey.checkoutRequestHash !== hash) {
          throw new Error("This checkout idempotency key was already used with different order details.");
        }
        return resultFromOrder(sameKey, true);
      }

      if (reservation.status !== "reserved" || reservation.expiresAt <= now) {
        if (reservation.status === "reserved") {
          await tx.update(inventoryReservations).set({ status: "expired" })
            .where(eq(inventoryReservations.id, reservation.id));
        }
        throw new Error("The inventory reservation has expired. Refresh your bag and reserve the pieces again.");
      }

      const [customer] = await tx.select({
        id: customerUsers.id,
        email: customerUsers.email,
        isActive: customerUsers.isActive,
      }).from(customerUsers)
        .where(eq(customerUsers.id, input.customerUserId))
        .limit(1);
      if (!customer || !customer.isActive) throw new Error("An active customer account is required.");

      const lines = await tx.select().from(inventoryReservationItems)
        .where(eq(inventoryReservationItems.reservationId, reservation.id))
        .orderBy(asc(inventoryReservationItems.variantId));
      if (lines.length < 1 || lines.length > 20) {
        throw new Error("The reservation must contain between one and twenty order lines.");
      }
      if (lines.some((line) =>
        !line.productIdSnapshot || !line.productTitleSnapshot || !line.variantLabelSnapshot
        || line.unitPriceMinorSnapshot === null || !line.currencySnapshot
        || line.selectedOptionsSnapshot === null
      )) {
        throw new Error("This reservation has no complete price snapshot. Release it and create a new reservation.");
      }

      const currencies = new Set(lines.map((line) => line.currencySnapshot));
      if (currencies.size !== 1) throw new Error("A checkout draft must use one currency.");
      const currency = [...currencies][0];
      if (!currency || !/^[A-Z]{3}$/.test(currency)) throw new Error("The reservation currency is invalid.");

      let subtotal = BigInt(0);
      for (const line of lines) {
        subtotal += safeMinor(line.unitPriceMinorSnapshot, "reserved unit price") * BigInt(line.quantity);
        if (subtotal > MAX_ORDER_MINOR) throw new Error("The order subtotal exceeds the supported amount.");
      }

      // The country code has already been normalized to exactly two uppercase letters.
      const zoneRows = await tx.select().from(shippingZones)
        .where(and(
          eq(shippingZones.isActive, true),
          sql.raw("JSON_CONTAINS(country_codes, JSON_QUOTE('" + countryCode + "'))"),
        ))
        .orderBy(asc(shippingZones.id))
        .for("update");
      if (zoneRows.length !== 1) {
        throw new Error("Shipping is not configured unambiguously for this delivery destination.");
      }
      const zone = zoneRows[0];

      const [rate] = await tx.select().from(shippingRates)
        .where(and(
          eq(shippingRates.id, input.shippingRateId),
          eq(shippingRates.zoneId, zone.id),
          eq(shippingRates.currency, currency),
          eq(shippingRates.isActive, true),
        ))
        .limit(1)
        .for("update");
      if (!rate || !rate.dutiesDisclosure.trim()) {
        throw new Error("The selected shipping option is not available for this destination and currency.");
      }

      const taxRules = await tx.select().from(checkoutTaxRules)
        .where(and(
          eq(checkoutTaxRules.countryCode, countryCode),
          eq(checkoutTaxRules.currency, currency),
          eq(checkoutTaxRules.isActive, true),
        ))
        .orderBy(asc(checkoutTaxRules.taxName))
        .for("update");
      if (taxRules.length === 0) {
        throw new Error("Tax policy is not configured for this destination and currency. An explicit zero-rate rule is required when no tax applies.");
      }

      const shipping = safeMinor(rate.amountMinor, "shipping amount");
      const taxResult = calculateCheckoutTax(subtotal, shipping, taxRules.map((rule) => ({
        name: rule.taxName,
        rateBasisPoints: rule.rateBasisPoints,
        taxableShipping: rule.taxableShipping,
      })));
      const taxBreakdown: TaxSnapshot[] = taxResult.breakdown;
      const tax = taxResult.taxMinor;
      const taxDisclosure = taxRules.map((rule) => rule.disclosure).join("\n");
      if (!taxDisclosure.trim() || taxDisclosure.length > 10000) throw new Error("The configured tax disclosure is invalid.");

      const subtotalMinor = safeNumber(subtotal, "subtotal");
      const shippingMinor = safeNumber(shipping, "shipping amount");
      const taxMinor = safeNumber(tax, "tax amount");
      const totalMinor = calculateCheckoutTotal({ subtotalMinor: subtotal, shippingMinor: shipping, taxMinor: tax });
      const expiresAt = getOrderDraftExpiry(reservation.expiresAt, now, DRAFT_LIFETIME_MS);
      const orderId = randomUUID();
      const orderNumber = "DAG-" + orderDateStamp(now) + "-" + randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();

      await tx.insert(orders).values({
        id: orderId,
        orderNumber,
        customerUserId: customer.id,
        email: customer.email,
        reservationId: reservation.id,
        checkoutIdempotencyKey: input.idempotencyKey.toLowerCase(),
        checkoutRequestHash: hash,
        status: "draft",
        currency,
        subtotalMinor,
        shippingMinor,
        taxMinor,
        discountMinor: 0,
        totalMinor,
        shippingAddress: { ...input.shippingAddress },
        customerNote: input.customerNote,
        expiresAt,
        shippingRateId: rate.id,
        shippingZoneName: zone.name,
        shippingRateName: rate.name,
        shippingDeliveryMinDays: rate.minDeliveryDays,
        shippingDeliveryMaxDays: rate.maxDeliveryDays,
        dutiesDisclosure: rate.dutiesDisclosure,
        taxBreakdown,
        taxDisclosure,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(orderItems).values(lines.map((line) => {
        const unitPriceMinor = safeNumber(safeMinor(line.unitPriceMinorSnapshot, "unit price"), "unit price");
        return {
          id: randomUUID(),
          orderId,
          productIdSnapshot: line.productIdSnapshot!,
          variantIdSnapshot: line.variantId,
          productTitle: line.productTitleSnapshot!,
          productSku: line.productSkuSnapshot,
          variantLabel: line.variantLabelSnapshot!,
          quantity: line.quantity,
          unitPriceMinor,
          lineTotalMinor: safeNumber(BigInt(unitPriceMinor) * BigInt(line.quantity), "line total"),
          selectedOptions: line.selectedOptionsSnapshot ?? {},
          createdAt: now,
        };
      }));

      await tx.insert(orderEvents).values({
        id: randomUUID(),
        orderId,
        actorType: "customer",
        actorId: customer.id,
        eventType: "order_draft_created",
        fromStatus: null,
        toStatus: "draft",
        note: "An unpaid draft was prepared from a live stock reservation.",
        createdAt: now,
      });

      const [created] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      return resultFromOrder(created, false);
    });
  } catch (error) {
    // Idempotent concurrency fallback for the unique reservation and customer/key indexes.
    if ((error as { code?: string } | null)?.code !== "ER_DUP_ENTRY") throw error;
    const [existing] = await db.select().from(orders)
      .where(and(
        eq(orders.customerUserId, input.customerUserId),
        eq(orders.checkoutIdempotencyKey, input.idempotencyKey),
      ))
      .limit(1);
    if (!existing || existing.checkoutRequestHash !== hash) {
      throw new Error("The order draft already exists with different checkout details.");
    }
    return resultFromOrder(existing, true);
  }
}

export async function listMySqlCustomerOrders(customerUserId: string) {
  return getMySqlDb().select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    status: orders.status,
    currency: orders.currency,
    subtotalMinor: orders.subtotalMinor,
    shippingMinor: orders.shippingMinor,
    taxMinor: orders.taxMinor,
    discountMinor: orders.discountMinor,
    totalMinor: orders.totalMinor,
    createdAt: orders.createdAt,
    expiresAt: orders.expiresAt,
    shippingRateName: orders.shippingRateName,
  }).from(orders)
    .where(eq(orders.customerUserId, customerUserId))
    .orderBy(desc(orders.createdAt))
    .limit(50);
}

export async function getMySqlCustomerOrder(customerUserId: string, orderId: string) {
  const [order] = await getMySqlDb().select().from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.customerUserId, customerUserId)))
    .limit(1);
  if (!order) return null;
  const items = await getMySqlDb().select().from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.createdAt), asc(orderItems.id));
  return { order, items };
}

export async function listMySqlAdminOrders() {
  return getMySqlDb().select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    email: orders.email,
    status: orders.status,
    currency: orders.currency,
    totalMinor: orders.totalMinor,
    createdAt: orders.createdAt,
    expiresAt: orders.expiresAt,
    trackingNumber: orders.trackingNumber,
  }).from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(250);
}

export async function getMySqlAdminOrder(orderId: string) {
  const [order] = await getMySqlDb().select().from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return null;
  const [items, events] = await Promise.all([
    getMySqlDb().select().from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.createdAt), asc(orderItems.id)),
    getMySqlDb().select().from(orderEvents)
      .where(eq(orderEvents.orderId, orderId))
      .orderBy(asc(orderEvents.createdAt), asc(orderEvents.id)),
  ]);
  return { order, items, events };
}

export async function transitionMySqlOrderFulfilment(input: {
  adminId: string;
  orderId: string;
  nextStatus: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.orderId)) {
    throw new Error("A valid order is required.");
  }
  if (!["processing", "shipped", "delivered"].includes(input.nextStatus)) {
    throw new Error("The requested fulfilment transition is not allowed.");
  }
  if (input.nextStatus === "shipped" && (!input.carrier?.trim() || !input.trackingNumber?.trim())) {
    throw new Error("Carrier and tracking number are required before shipment.");
  }
  let trackingUrl: string | null = null;
  if (input.trackingUrl) {
    try {
      const parsed = new URL(input.trackingUrl);
      if (parsed.protocol !== "https:") throw new Error();
      trackingUrl = parsed.toString();
    } catch {
      throw new Error("Tracking URL must be a valid HTTPS link.");
    }
  }

  await getMySqlDb().transaction(async (tx) => {
    const [order] = await tx.select().from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1)
      .for("update");
    if (!order) throw new Error("Order was not found.");
    const allowed =
      (order.status === "paid" && input.nextStatus === "processing")
      || (order.status === "processing" && input.nextStatus === "shipped")
      || (order.status === "shipped" && input.nextStatus === "delivered");
    if (!allowed) throw new Error("Only the preceding paid/fulfilment state can be advanced.");
    const nextStatus = input.nextStatus as MySqlOrderStatus;
    await tx.update(orders).set({
      status: nextStatus,
      ...(nextStatus === "shipped" ? {
        trackingCarrier: input.carrier?.trim() ?? null,
        trackingNumber: input.trackingNumber?.trim() ?? null,
        trackingUrl,
        shippedAt: order.shippedAt ?? now,
      } : {}),
      ...(nextStatus === "delivered" ? { deliveredAt: order.deliveredAt ?? now } : {}),
      updatedAt: now,
    }).where(eq(orders.id, order.id));
    await tx.insert(orderEvents).values({
      id: randomUUID(),
      orderId: order.id,
      actorType: "admin",
      actorId: input.adminId,
      eventType: "fulfilment_transition",
      fromStatus: order.status,
      toStatus: nextStatus,
      note: nextStatus === "shipped" ? "Shipment details recorded." : null,
      createdAt: now,
    });
  });
}

export async function listMySqlCheckoutConfiguration() {
  const db = getMySqlDb();
  const [zones, rates, taxes] = await Promise.all([
    db.select().from(shippingZones).orderBy(asc(shippingZones.name)),
    db.select().from(shippingRates).orderBy(asc(shippingRates.name)),
    db.select().from(checkoutTaxRules)
      .orderBy(asc(checkoutTaxRules.countryCode), asc(checkoutTaxRules.currency), asc(checkoutTaxRules.taxName)),
  ]);
  return { zones, rates, taxes };
}

export async function saveMySqlShippingZone(input: {
  id?: string; name: string; countryCodesText: string; isActive: boolean;
}) {
  const name = input.name.trim();
  const countries = normalizeCountryCodes(input.countryCodesText);
  if (!name || name.length > 120 || !countries) {
    throw new Error("Provide a zone name and one to fifty valid country codes.");
  }
  const db = getMySqlDb();
  const now = new Date();
  if (input.id) {
    await db.update(shippingZones).set({ name, countryCodes: countries, isActive: input.isActive, updatedAt: now })
      .where(eq(shippingZones.id, input.id));
  } else {
    await db.insert(shippingZones).values({
      id: randomUUID(), name, countryCodes: countries, isActive: input.isActive, createdAt: now, updatedAt: now,
    });
  }
}

export async function saveMySqlShippingRate(input: {
  id?: string; zoneId: string; name: string; currency: string; amount: string;
  minDays: string; maxDays: string; dutiesDisclosure: string; isActive: boolean;
}) {
  const name = input.name.trim();
  const currency = input.currency.trim().toUpperCase();
  const dutiesDisclosure = input.dutiesDisclosure.trim();
  const amountMinor = parseCurrencyAmountToMinor(input.amount, currency);
  if (!/^[0-9a-f-]{36}$/i.test(input.zoneId) || !name || name.length > 120
    || !/^[A-Z]{3}$/.test(currency) || amountMinor === null
    || !dutiesDisclosure || dutiesDisclosure.length > 2000) {
    throw new Error("A valid zone, name, currency, amount and duties disclosure are required.");
  }
  const parseDays = (value: string): number | null => {
    if (!value.trim()) return null;
    if (!/^[0-9]{1,3}$/.test(value.trim())) throw new Error("Delivery days must be whole numbers from 0 to 365.");
    const days = Number(value);
    if (!Number.isInteger(days) || days < 0 || days > 365) throw new Error("Delivery days must be whole numbers from 0 to 365.");
    return days;
  };
  const minDeliveryDays = parseDays(input.minDays);
  const maxDeliveryDays = parseDays(input.maxDays);
  if ((minDeliveryDays === null) !== (maxDeliveryDays === null)
    || (minDeliveryDays !== null && maxDeliveryDays !== null && maxDeliveryDays < minDeliveryDays)) {
    throw new Error("Enter both delivery-window endpoints and ensure the maximum is not below the minimum.");
  }
  const db = getMySqlDb();
  const [zone] = await db.select({ id: shippingZones.id }).from(shippingZones)
    .where(eq(shippingZones.id, input.zoneId)).limit(1);
  if (!zone) throw new Error("The selected shipping zone was not found.");
  const now = new Date();
  const values = {
    zoneId: input.zoneId, name, currency, amountMinor,
    minDeliveryDays, maxDeliveryDays, dutiesDisclosure, isActive: input.isActive, updatedAt: now,
  };
  if (input.id) {
    await db.update(shippingRates).set(values).where(eq(shippingRates.id, input.id));
  } else {
    await db.insert(shippingRates).values({ id: randomUUID(), ...values, createdAt: now });
  }
}

export async function saveMySqlTaxRule(input: {
  id?: string; countryCode: string; currency: string; taxName: string;
  rateBasisPoints: string; taxableShipping: boolean; disclosure: string; isActive: boolean;
}) {
  const countryCode = input.countryCode.trim().toUpperCase();
  const currency = input.currency.trim().toUpperCase();
  const taxName = input.taxName.trim();
  const disclosure = input.disclosure.trim();
  if (!/^[A-Z]{2}$/.test(countryCode) || !/^[A-Z]{3}$/.test(currency)
    || !taxName || taxName.length > 120 || !disclosure || disclosure.length > 2000
    || !/^[0-9]{1,5}$/.test(input.rateBasisPoints)) {
    throw new Error("Provide a valid country, currency, tax name, basis-point rate and disclosure.");
  }
  const rateBasisPoints = Number(input.rateBasisPoints);
  if (!Number.isInteger(rateBasisPoints) || rateBasisPoints < 0 || rateBasisPoints > 10000) {
    throw new Error("Tax rate must be a whole number from 0 to 10,000 basis points.");
  }
  const db = getMySqlDb();
  const values = {
    countryCode, currency, taxName, rateBasisPoints,
    taxableShipping: input.taxableShipping, disclosure, isActive: input.isActive, updatedAt: new Date(),
  };
  if (input.id) {
    await db.update(checkoutTaxRules).set(values).where(eq(checkoutTaxRules.id, input.id));
  } else {
    await db.insert(checkoutTaxRules).values({ id: randomUUID(), ...values, createdAt: new Date() });
  }
}
