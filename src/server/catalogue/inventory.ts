import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { getMySqlDb } from "../db";
import {
  inventoryMovements, inventoryReservationItems, inventoryReservations,
  orderEvents, orders, products, productVariants,
} from "../db/schema";

export type ReservationStatus = "reserved" | "released" | "expired" | "consumed";
export type ReservationRequest = {
  customerReference: string;
  idempotencyKey: string;
  items: Array<{ variantId: string; quantity: number }>;
  expiresAt: Date;
};
export type ReservationResult = {
  reservationId: string;
  status: ReservationStatus;
  expiresAt: Date;
};

type ReservationLine = { variantId: string; quantity: number };

function normalizeItems(items: ReservationRequest["items"]): ReservationLine[] {
  if (!Array.isArray(items) || items.length < 1 || items.length > 40) {
    throw new Error("A reservation must contain between 1 and 40 variants.");
  }
  const combined = new Map<string, number>();
  for (const item of items) {
    if (!/^[0-9a-f-]{36}$/i.test(item.variantId)) throw new Error("A valid variant ID is required.");
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
      throw new Error("Each reservation quantity must be a whole number between 1 and 100.");
    }
    combined.set(item.variantId, (combined.get(item.variantId) ?? 0) + item.quantity);
  }
  const normalized = [...combined.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
  if (normalized.some((item) => item.quantity > 100)) throw new Error("Combined variant quantity exceeds the supported limit.");
  return normalized.sort((a, b) => a.variantId.localeCompare(b.variantId));
}

function sameItems(left: ReservationLine[], right: ReservationLine[]): boolean {
  return left.length === right.length && left.every((item, index) =>
    item.variantId === right[index]?.variantId && item.quantity === right[index]?.quantity);
}

async function readReservationLines(reservationId: string): Promise<ReservationLine[]> {
  const rows = await getMySqlDb().select({
    variantId: inventoryReservationItems.variantId,
    quantity: inventoryReservationItems.quantity,
  }).from(inventoryReservationItems)
    .where(eq(inventoryReservationItems.reservationId, reservationId))
    .orderBy(asc(inventoryReservationItems.variantId));
  return rows;
}

export async function reserveVariantStock(input: ReservationRequest, now = new Date()): Promise<ReservationResult> {
  const customerReference = input.customerReference.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (!customerReference || customerReference.length > 180) throw new Error("Customer reference is required and must be 180 characters or fewer.");
  if (!idempotencyKey || idempotencyKey.length > 180) throw new Error("An idempotency key is required and must be 180 characters or fewer.");
  const items = normalizeItems(input.items);
  const expiresAt = new Date(input.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) throw new Error("Reservation expiry must be in the future.");
  if (expiresAt.getTime() > now.getTime() + 2 * 60 * 60 * 1000) throw new Error("A stock reservation cannot exceed two hours.");

  const db = getMySqlDb();
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(inventoryReservations)
        .where(eq(inventoryReservations.idempotencyKey, idempotencyKey))
        .limit(1).for("update");
      if (existing) {
        const oldItems = await tx.select({
          variantId: inventoryReservationItems.variantId,
          quantity: inventoryReservationItems.quantity,
        }).from(inventoryReservationItems)
          .where(eq(inventoryReservationItems.reservationId, existing.id))
          .orderBy(asc(inventoryReservationItems.variantId));
        if (!sameItems(oldItems, items) || existing.customerReference !== customerReference) {
          throw new Error("This idempotency key is already associated with a different reservation.");
        }
        if (existing.status === "reserved" && existing.expiresAt <= now) {
          await tx.update(inventoryReservations).set({ status: "expired" })
            .where(eq(inventoryReservations.id, existing.id));
          return { reservationId: existing.id, status: "expired", expiresAt: existing.expiresAt };
        }
        if (existing.status === "reserved" || existing.status === "consumed") {
          return { reservationId: existing.id, status: existing.status as ReservationStatus, expiresAt: existing.expiresAt };
        }
        throw new Error("This reservation key has already been released or expired. Use a new idempotency key.");
      }

      const variantIds = items.map((item) => item.variantId);
      const lockedVariants = await tx.select().from(productVariants)
        .where(inArray(productVariants.id, variantIds))
        .orderBy(asc(productVariants.id))
        .for("update");
      if (lockedVariants.length !== variantIds.length) throw new Error("One or more product variants no longer exist.");
      const productIds = [...new Set(lockedVariants.map((variant) => variant.productId))];
      const lockedProducts = await tx.select().from(products)
        .where(inArray(products.id, productIds))
        .orderBy(asc(products.id))
        .for("update");
      const productById = new Map(lockedProducts.map((product) => [product.id, product]));
      const variantById = new Map(lockedVariants.map((variant) => [variant.id, variant]));
      for (const variant of lockedVariants) {
        const product = productById.get(variant.productId);
        if (!variant.isActive || !product || product.status !== "published") {
          throw new Error("Only active variants of published products can be reserved.");
        }
        if (variant.currency !== product.currency) {
          throw new Error("The product option currency does not match its product currency.");
        }
        const unitPrice = variant.priceMinor ?? product.priceMinor;
        if (!Number.isSafeInteger(unitPrice) || unitPrice < 0 || !/^[A-Z]{3}$/.test(variant.currency)) {
          throw new Error("The product option does not have a supported verified price.");
        }
      }

      // The product row is locked above, so supported inventory writers for every
      // variant of these products are serialized here. Read the full variant set
      // without FOR UPDATE: locking sibling variant rows here can deadlock with a
      // concurrent reservation that already holds its selected variant row.
      const productVariantRows = await tx.select({
        id: productVariants.id,
        productId: productVariants.productId,
        stockQuantity: productVariants.stockQuantity,
      }).from(productVariants)
        .where(inArray(productVariants.productId, productIds));
      const productIdByVariantId = new Map(productVariantRows.map((variant) => [variant.id, variant.productId]));
      const stockByProduct = new Map<string, number>();
      for (const variant of productVariantRows) {
        // One-of-a-kind validation only needs to distinguish 0, 1 and >1.
        stockByProduct.set(variant.productId, Math.min(2,
          (stockByProduct.get(variant.productId) ?? 0) + variant.stockQuantity));
      }

      const allVariantIds = productVariantRows.map((variant) => variant.id);
      const activeRows = await tx.select({
        variantId: inventoryReservationItems.variantId,
        quantity: inventoryReservationItems.quantity,
      }).from(inventoryReservationItems)
        .innerJoin(inventoryReservations, eq(inventoryReservations.id, inventoryReservationItems.reservationId))
        .where(and(
          inArray(inventoryReservationItems.variantId, allVariantIds),
          eq(inventoryReservations.status, "reserved"),
          gt(inventoryReservations.expiresAt, now),
        ))
        .for("update");
      const reservedByVariant = new Map<string, number>();
      const reservedByProduct = new Map<string, number>();
      for (const row of activeRows) {
        reservedByVariant.set(row.variantId, (reservedByVariant.get(row.variantId) ?? 0) + row.quantity);
        const productId = productIdByVariantId.get(row.variantId);
        if (productId) reservedByProduct.set(productId, Math.min(2,
          (reservedByProduct.get(productId) ?? 0) + row.quantity));
      }

      if (new Set(lockedVariants.map((variant) => variant.currency)).size !== 1) {
        throw new Error("A reservation must contain products priced in one currency.");
      }
      const requestedByProduct = new Map<string, number>();
      for (const item of items) {
        const variant = variantById.get(item.variantId)!;
        const product = productById.get(variant.productId)!;
        const requestedForProduct = (requestedByProduct.get(product.id) ?? 0) + item.quantity;
        requestedByProduct.set(product.id, requestedForProduct);
        const available = variant.stockQuantity - (reservedByVariant.get(item.variantId) ?? 0);
        const productReserved = reservedByProduct.get(product.id) ?? 0;
        const oneOfAKindInventoryIsValid = !product.isOneOfAKind
          || (stockByProduct.get(product.id) ?? 0) <= 1;
        if (available < item.quantity
          || (product.isOneOfAKind && (!oneOfAKindInventoryIsValid || productReserved + requestedForProduct > 1))) {
          throw new Error("Insufficient available stock for variant " + variant.label + ".");
        }
      }

      const reservationId = randomUUID();
      await tx.insert(inventoryReservations).values({
        id: reservationId, customerReference, idempotencyKey,
        status: "reserved", expiresAt, createdAt: now,
      });
      await tx.insert(inventoryReservationItems).values(items.map((item) => {
        const variant = variantById.get(item.variantId)!;
        const product = productById.get(variant.productId)!;
        return {
          id: randomUUID(),
          reservationId,
          variantId: item.variantId,
          quantity: item.quantity,
          productIdSnapshot: product.id,
          productTitleSnapshot: product.title,
          productSkuSnapshot: variant.sku,
          variantLabelSnapshot: variant.label,
          selectedOptionsSnapshot: variant.attributes ?? {},
          unitPriceMinorSnapshot: variant.priceMinor ?? product.priceMinor,
          currencySnapshot: variant.currency,
        };
      }));
      return { reservationId, status: "reserved", expiresAt };
    });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ER_DUP_ENTRY") {
      const [duplicate] = await db.select().from(inventoryReservations)
        .where(eq(inventoryReservations.idempotencyKey, idempotencyKey)).limit(1);
      if (duplicate) {
        const duplicateItems = await readReservationLines(duplicate.id);
        if (duplicate.customerReference === customerReference && sameItems(duplicateItems, items)
          && (duplicate.status === "consumed" || (duplicate.status === "reserved" && duplicate.expiresAt > now))) {
          return {
            reservationId: duplicate.id,
            status: duplicate.status as ReservationStatus,
            expiresAt: duplicate.expiresAt,
          };
        }
      }
    }
    throw error;
  }
}

export async function releaseVariantStockReservation(reservationId: string, now = new Date()): Promise<ReservationStatus> {
  const db = getMySqlDb();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(inventoryReservations)
      .where(eq(inventoryReservations.id, reservationId)).limit(1).for("update");
    if (!row) throw new Error("Stock reservation was not found.");
    if (row.status !== "reserved") return row.status as ReservationStatus;
    const status: ReservationStatus = row.expiresAt <= now ? "expired" : "released";
    await tx.update(inventoryReservations).set({ status }).where(eq(inventoryReservations.id, reservationId));
    const [draftOrder] = await tx.select().from(orders)
      .where(and(eq(orders.reservationId, reservationId), eq(orders.status, "draft")))
      .limit(1).for("update");
    if (draftOrder) {
      const nextStatus = status === "expired" ? "expired" : "cancelled";
      await tx.update(orders).set({ status: nextStatus, updatedAt: now })
        .where(eq(orders.id, draftOrder.id));
      await tx.insert(orderEvents).values({
        id: randomUUID(),
        orderId: draftOrder.id,
        actorType: "system",
        actorId: null,
        eventType: status === "expired" ? "reservation_expired" : "reservation_released",
        fromStatus: "draft",
        toStatus: nextStatus,
        note: "The inventory reservation is no longer active.",
        createdAt: now,
      });
    }
    return status;
  });
}

export async function consumeVariantStockReservation(reservationId: string, now = new Date()): Promise<ReservationStatus> {
  const db = getMySqlDb();
  return db.transaction(async (tx) => {
    // Read the item IDs first, then acquire variant locks before the reservation lock.
    // Reserve/adjust paths use this same variant -> reservation lock order to avoid deadlocks.
    const [snapshot] = await tx.select().from(inventoryReservations)
      .where(eq(inventoryReservations.id, reservationId)).limit(1);
    if (!snapshot) throw new Error("Stock reservation was not found.");
    const items = await tx.select({
      variantId: inventoryReservationItems.variantId,
      quantity: inventoryReservationItems.quantity,
    }).from(inventoryReservationItems)
      .where(eq(inventoryReservationItems.reservationId, reservationId))
      .orderBy(asc(inventoryReservationItems.variantId));
    if (!items.length) throw new Error("Reservation has no line items.");

    const variantIds = items.map((item) => item.variantId);
    const variants = await tx.select().from(productVariants)
      .where(inArray(productVariants.id, variantIds))
      .orderBy(asc(productVariants.id))
      .for("update");

    const [reservation] = await tx.select().from(inventoryReservations)
      .where(eq(inventoryReservations.id, reservationId)).limit(1).for("update");
    if (!reservation) throw new Error("Stock reservation was not found.");
    if (reservation.status === "consumed") return "consumed";
    if (reservation.status !== "reserved") return reservation.status as ReservationStatus;
    if (reservation.expiresAt <= now) {
      await tx.update(inventoryReservations).set({ status: "expired" })
        .where(eq(inventoryReservations.id, reservationId));
      return "expired";
    }

    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    for (const item of items) {
      const variant = variantById.get(item.variantId);
      if (!variant || variant.stockQuantity < item.quantity) {
        throw new Error("Stock no longer covers this reservation. Reconcile inventory before consuming it.");
      }
    }

    for (const item of items) {
      const variant = variantById.get(item.variantId)!;
      const referenceKey = "reservation:" + reservationId + ":" + item.variantId;
      await tx.insert(inventoryMovements).values({
        id: randomUUID(), variantId: item.variantId, quantityDelta: -item.quantity,
        reason: "Reservation consumed", referenceKey, actorId: null, createdAt: now,
      });
      await tx.update(productVariants).set({
        stockQuantity: variant.stockQuantity - item.quantity,
        updatedAt: now,
      }).where(eq(productVariants.id, item.variantId));
    }
    await tx.update(inventoryReservations).set({ status: "consumed" })
      .where(eq(inventoryReservations.id, reservationId));
    return "consumed";
  });
}

export async function expireVariantStockReservations(limit = 100, now = new Date()): Promise<number> {
  const boundedLimit = Math.min(500, Math.max(1, Math.floor(limit)));
  const expired = await getMySqlDb().select({ id: inventoryReservations.id })
    .from(inventoryReservations)
    .where(and(
      eq(inventoryReservations.status, "reserved"),
      sql`${inventoryReservations.expiresAt} <= ${now}`,
    ))
    .orderBy(asc(inventoryReservations.expiresAt))
    .limit(boundedLimit);
  let count = 0;
  for (const row of expired) {
    if (await releaseVariantStockReservation(row.id, now) === "expired") count += 1;
  }
  return count;
}

export async function adjustVariantInventory(input: {
  variantId: string;
  quantityDelta: number;
  reason: string;
  referenceKey: string;
  actorId: string | null;
}, now = new Date()): Promise<void> {
  const reason = input.reason.trim();
  const referenceKey = input.referenceKey.trim();
  if (!/^[0-9a-f-]{36}$/i.test(input.variantId)) throw new Error("A valid variant ID is required.");
  if (!Number.isSafeInteger(input.quantityDelta) || input.quantityDelta === 0) throw new Error("Inventory change must be a non-zero whole number.");
  if (!reason || reason.length > 160 || !referenceKey || referenceKey.length > 180) {
    throw new Error("An inventory reason and idempotency reference are required.");
  }

  const db = getMySqlDb();
  await db.transaction(async (tx) => {
    const [variant] = await tx.select().from(productVariants)
      .where(eq(productVariants.id, input.variantId)).limit(1).for("update");
    if (!variant || !variant.isActive) throw new Error("An active product variant was not found.");
    const [product] = await tx.select().from(products)
      .where(eq(products.id, variant.productId)).limit(1).for("update");
    if (!product || product.status === "archived") throw new Error("Inventory cannot be changed for an archived product.");

    const [existing] = await tx.select().from(inventoryMovements)
      .where(eq(inventoryMovements.referenceKey, referenceKey)).limit(1);
    if (existing) {
      if (existing.variantId === input.variantId && existing.quantityDelta === input.quantityDelta && existing.reason === reason) return;
      throw new Error("This inventory reference has already been used for a different movement.");
    }

    // Inventory changes for a product are serialized by its product row lock.
    // Evaluate reservations and physical stock across every variant so a one-off
    // piece cannot be duplicated by adding stock to a sibling option.
    const productVariantsForStock = await tx.select({
      id: productVariants.id,
      stockQuantity: productVariants.stockQuantity,
    }).from(productVariants)
      .where(eq(productVariants.productId, product.id));
    const productVariantIds = productVariantsForStock.map((row) => row.id);
    const activeReservations = await tx.select({
      variantId: inventoryReservationItems.variantId,
      quantity: inventoryReservationItems.quantity,
    }).from(inventoryReservationItems)
      .innerJoin(inventoryReservations, eq(inventoryReservations.id, inventoryReservationItems.reservationId))
      .where(and(
        inArray(inventoryReservationItems.variantId, productVariantIds),
        eq(inventoryReservations.status, "reserved"),
        gt(inventoryReservations.expiresAt, now),
      ))
      .for("update");
    const reservedByVariant = new Map<string, number>();
    let reservedAcrossProduct = 0;
    for (const row of activeReservations) {
      reservedByVariant.set(row.variantId, (reservedByVariant.get(row.variantId) ?? 0) + row.quantity);
      reservedAcrossProduct += row.quantity;
    }
    const reservedForVariant = reservedByVariant.get(input.variantId) ?? 0;
    const next = variant.stockQuantity + input.quantityDelta;
    if (!Number.isSafeInteger(next) || next < reservedForVariant || next > 2147483647) {
      throw new Error("Adjustment would reduce stock below reserved quantity or exceed the supported balance.");
    }
    if (product.isOneOfAKind) {
      const stockAcrossProduct = productVariantsForStock.reduce((total, row) => total + row.stockQuantity, 0);
      const nextProductStock = stockAcrossProduct + input.quantityDelta;
      if (!Number.isSafeInteger(stockAcrossProduct) || !Number.isSafeInteger(nextProductStock)
        || nextProductStock < reservedAcrossProduct || nextProductStock < 0 || nextProductStock > 1) {
        throw new Error("A one-of-a-kind product may have at most one unit of stock across all variants, and stock cannot fall below active reservations.");
      }
    }

    await tx.insert(inventoryMovements).values({
      id: randomUUID(), variantId: input.variantId, quantityDelta: input.quantityDelta,
      reason, referenceKey, actorId: input.actorId, createdAt: now,
    });
    await tx.update(productVariants).set({ stockQuantity: next, updatedAt: now })
      .where(eq(productVariants.id, input.variantId));
  });
}
