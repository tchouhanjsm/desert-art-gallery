import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getMySqlDb } from "@/server/db";
import {
  inventoryMovements,
  inventoryReservationItems,
  inventoryReservations,
  orderEvents,
  orders,
  paymentAttempts,
  paymentWebhookEvents,
  products,
  productVariants,
  type MySqlPaymentAttemptStatus,
} from "@/server/db/schema";
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpaySandboxConfiguration,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
  type RazorpayPayment,
} from "./razorpay";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SAFE_MINOR = Number.MAX_SAFE_INTEGER;

export type PaymentSessionResult = {
  orderId: string;
  orderNumber: string;
  providerOrderId: string;
  keyId: string;
  amountMinor: number;
  currency: string;
  replayed: boolean;
};

export type VerifiedPaymentResult =
  | { status: "paid"; orderId: string; replayed: boolean }
  | { status: "authorized"; orderId: string; message: string }
  | { status: "failed"; orderId: string; message: string }
  | { status: "captured_after_expiry"; orderId: string; message: string }
  | { status: "pending"; orderId: string; message: string };

function hashRequest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function isDuplicateEntry(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "ER_DUP_ENTRY";
}

function assertProviderPaymentMatches(
  payment: RazorpayPayment,
  attempt: {
    providerOrderId: string | null;
    amountMinor: number;
    currency: string;
  },
): void {
  if (!attempt.providerOrderId
    || payment.order_id !== attempt.providerOrderId
    || payment.amount !== attempt.amountMinor
    || payment.currency !== attempt.currency) {
    throw new Error("The provider payment does not match the saved order amount and currency.");
  }
}

async function findPaymentSnapshot(providerOrderId: string) {
  const [row] = await getMySqlDb().select({
    attemptId: paymentAttempts.id,
    orderId: paymentAttempts.orderId,
    reservationId: orders.reservationId,
    providerOrderId: paymentAttempts.providerOrderId,
    amountMinor: paymentAttempts.amountMinor,
    currency: paymentAttempts.currency,
  }).from(paymentAttempts)
    .innerJoin(orders, eq(orders.id, paymentAttempts.orderId))
    .where(and(
      eq(paymentAttempts.provider, "razorpay"),
      eq(paymentAttempts.providerOrderId, providerOrderId),
    ))
    .limit(1);
  return row ?? null;
}

async function applyProviderPaymentState(input: {
  providerOrderId: string;
  payment: RazorpayPayment;
  now?: Date;
}): Promise<VerifiedPaymentResult | null> {
  const snapshot = await findPaymentSnapshot(input.providerOrderId);
  if (!snapshot) return null;

  const db = getMySqlDb();
  const now = input.now ?? new Date();
  const reservationItems = await db.select({
    variantId: inventoryReservationItems.variantId,
    quantity: inventoryReservationItems.quantity,
  }).from(inventoryReservationItems)
    .where(eq(inventoryReservationItems.reservationId, snapshot.reservationId))
    .orderBy(asc(inventoryReservationItems.variantId));

  if (reservationItems.length === 0) {
    throw new Error("The saved stock reservation has no item rows.");
  }

  return db.transaction(async (tx) => {
    // Match the inventory writer lock order: variants, products, reservation, order, payment attempt.
    const variantIds = reservationItems.map((item) => item.variantId);
    const variants = await tx.select().from(productVariants)
      .where(inArray(productVariants.id, variantIds))
      .orderBy(asc(productVariants.id))
      .for("update");
    if (variants.length !== variantIds.length) {
      throw new Error("Reserved product options are missing; payment requires manual reconciliation.");
    }

    const productIds = [...new Set(variants.map((variant) => variant.productId))].sort();
    const lockedProducts = await tx.select({ id: products.id }).from(products)
      .where(inArray(products.id, productIds))
      .orderBy(asc(products.id))
      .for("update");
    if (lockedProducts.length !== productIds.length) {
      throw new Error("A reserved product is missing; payment requires manual reconciliation.");
    }

    const [reservation] = await tx.select().from(inventoryReservations)
      .where(eq(inventoryReservations.id, snapshot.reservationId))
      .limit(1)
      .for("update");
    const [order] = await tx.select().from(orders)
      .where(eq(orders.id, snapshot.orderId))
      .limit(1)
      .for("update");
    const [attempt] = await tx.select().from(paymentAttempts)
      .where(eq(paymentAttempts.id, snapshot.attemptId))
      .limit(1)
      .for("update");

    if (!reservation || !order || !attempt
      || attempt.providerOrderId !== input.providerOrderId
      || order.reservationId !== reservation.id) {
      throw new Error("The payment attempt could not be reconciled with its order and reservation.");
    }
    assertProviderPaymentMatches(input.payment, attempt);

    if (attempt.status === "captured" && order.status !== "refunded") {
      return { status: "paid", orderId: order.id, replayed: true } as const;
    }
    if (attempt.status === "captured_after_expiry") {
      return {
        status: "captured_after_expiry",
        orderId: order.id,
        message: "Payment was captured after the order reservation closed. The order is held for owner refund review.",
      } as const;
    }

    if (input.payment.status === "captured" && input.payment.captured) {
      const reservationOpen = reservation.status === "reserved" && reservation.expiresAt > now;
      const orderOpen = (order.status === "draft" || order.status === "pending_payment")
        && order.expiresAt > now;
      const stockByVariant = new Map(variants.map((variant) => [variant.id, variant]));

      const stockValid = reservationItems.every((item) => {
        const variant = stockByVariant.get(item.variantId);
        return Boolean(variant && variant.stockQuantity >= item.quantity);
      });

      if (!reservationOpen || !orderOpen || !stockValid) {
        if (reservation.status === "reserved" && reservation.expiresAt <= now) {
          await tx.update(inventoryReservations).set({ status: "expired" })
            .where(eq(inventoryReservations.id, reservation.id));
        }
        const nextOrderStatus = order.status === "draft" || order.status === "pending_payment"
          ? "expired"
          : order.status;
        if (nextOrderStatus !== order.status) {
          await tx.update(orders).set({ status: "expired", updatedAt: now })
            .where(eq(orders.id, order.id));
        }
        await tx.update(paymentAttempts).set({
          status: "captured_after_expiry",
          providerPaymentId: input.payment.id,
          capturedAt: now,
          updatedAt: now,
          failureCode: stockValid ? "RESERVATION_CLOSED" : "RESERVED_STOCK_MISMATCH",
        }).where(eq(paymentAttempts.id, attempt.id));
        await tx.insert(orderEvents).values({
          id: randomUUID(),
          orderId: order.id,
          actorType: "system",
          actorId: null,
          eventType: "payment_captured_after_reservation_closed",
          fromStatus: order.status,
          toStatus: nextOrderStatus,
          note: "Provider confirmed capture after the order or stock reservation became unavailable. Fulfilment is blocked pending owner review.",
          createdAt: now,
        });
        return {
          status: "captured_after_expiry",
          orderId: order.id,
          message: "Payment was captured, but the stock reservation or order expired. Fulfilment is blocked pending owner review.",
        } as const;
      }

      for (const item of reservationItems) {
        const variant = stockByVariant.get(item.variantId)!;
        await tx.insert(inventoryMovements).values({
          id: randomUUID(),
          variantId: item.variantId,
          quantityDelta: -item.quantity,
          reason: "Paid order reservation consumed",
          referenceKey: "reservation:" + reservation.id + ":" + item.variantId,
          actorId: null,
          createdAt: now,
        });
        await tx.update(productVariants).set({
          stockQuantity: variant.stockQuantity - item.quantity,
          updatedAt: now,
        }).where(eq(productVariants.id, item.variantId));
      }

      await tx.update(inventoryReservations).set({ status: "consumed" })
        .where(eq(inventoryReservations.id, reservation.id));
      await tx.update(paymentAttempts).set({
        status: "captured",
        providerPaymentId: input.payment.id,
        capturedAt: now,
        failureCode: null,
        updatedAt: now,
      }).where(eq(paymentAttempts.id, attempt.id));
      await tx.update(orders).set({ status: "paid", updatedAt: now })
        .where(eq(orders.id, order.id));
      await tx.insert(orderEvents).values({
        id: randomUUID(),
        orderId: order.id,
        actorType: "system",
        actorId: null,
        eventType: "payment_captured",
        fromStatus: order.status,
        toStatus: "paid",
        note: "Provider payment status, order reference, amount and currency were verified before stock consumption.",
        createdAt: now,
      });
      return { status: "paid", orderId: order.id, replayed: false } as const;
    }

    if (input.payment.status === "authorized" && !input.payment.captured) {
      if (order.status === "draft" && order.expiresAt > now
        && reservation.status === "reserved" && reservation.expiresAt > now) {
        await tx.update(orders).set({ status: "pending_payment", updatedAt: now })
          .where(eq(orders.id, order.id));
      }
      await tx.update(paymentAttempts).set({
        status: "authorized",
        providerPaymentId: input.payment.id,
        authorizedAt: attempt.authorizedAt ?? now,
        updatedAt: now,
      }).where(eq(paymentAttempts.id, attempt.id));
      if (order.status === "draft" && order.expiresAt > now
        && reservation.status === "reserved" && reservation.expiresAt > now) {
        await tx.insert(orderEvents).values({
          id: randomUUID(),
          orderId: order.id,
          actorType: "system",
          actorId: null,
          eventType: "payment_authorized",
          fromStatus: "draft",
          toStatus: "pending_payment",
          note: "Payment authorization is not a captured payment; fulfilment remains blocked.",
          createdAt: now,
        });
      }
      return {
        status: "authorized",
        orderId: order.id,
        message: "Payment was authorized but is not yet captured. The order will not be fulfilled until capture is confirmed.",
      } as const;
    }

    if (input.payment.status === "failed") {
      if (attempt.status !== "captured" && attempt.status !== "captured_after_expiry") {
        await tx.update(paymentAttempts).set({
          status: "failed",
          providerPaymentId: input.payment.id,
          failureCode: "PROVIDER_PAYMENT_FAILED",
          updatedAt: now,
        }).where(eq(paymentAttempts.id, attempt.id));
        await tx.insert(orderEvents).values({
          id: randomUUID(),
          orderId: order.id,
          actorType: "system",
          actorId: null,
          eventType: "payment_failed",
          fromStatus: order.status,
          toStatus: order.status,
          note: "The provider reported a failed payment attempt. No fulfilment action was taken.",
          createdAt: now,
        });
      }
      return {
        status: "failed",
        orderId: order.id,
        message: "The payment attempt failed. No fulfilment action was taken.",
      } as const;
    }

    if (input.payment.status === "refunded") {
      return {
        status: "pending",
        orderId: order.id,
        message: "The provider reports a refunded payment. Refresh the order or contact the gallery for reconciliation.",
      } as const;
    }

    if (attempt.status === "creating" || attempt.status === "creation_unknown") {
      return {
        status: "pending",
        orderId: order.id,
        message: "The provider payment is not yet in a confirmed state. Do not start another payment attempt.",
      } as const;
    }

    return {
      status: "pending",
      orderId: order.id,
      message: "The provider has not confirmed a captured payment yet.",
    } as const;
  });
}

export async function createMySqlRazorpayPaymentSession(input: {
  customerUserId: string;
  orderId: string;
  idempotencyKey: string;
  now?: Date;
}): Promise<PaymentSessionResult> {
  getRazorpaySandboxConfiguration();
  if (!isUuid(input.orderId) || !isUuid(input.idempotencyKey)) {
    throw new Error("A valid order and payment idempotency key are required.");
  }

  const db = getMySqlDb();
  const [initialOrder] = await db.select({
    id: orders.id,
    reservationId: orders.reservationId,
  }).from(orders)
    .where(and(
      eq(orders.id, input.orderId),
      eq(orders.customerUserId, input.customerUserId),
    ))
    .limit(1);
  if (!initialOrder) throw new Error("The order was not found for this customer.");

  const now = input.now ?? new Date();
  const requestHash = hashRequest({
    orderId: input.orderId,
    customerUserId: input.customerUserId,
  });

  const prepared = await db.transaction(async (tx) => {
    // Keep order/reservation locking aligned with checkout release and expiry paths.
    const [reservation] = await tx.select().from(inventoryReservations)
      .where(eq(inventoryReservations.id, initialOrder.reservationId))
      .limit(1)
      .for("update");
    const [order] = await tx.select().from(orders)
      .where(and(
        eq(orders.id, input.orderId),
        eq(orders.customerUserId, input.customerUserId),
      ))
      .limit(1)
      .for("update");
    if (!reservation || !order) throw new Error("The order stock reservation is missing.");
    if (order.status === "paid" || order.status === "processing" || order.status === "shipped" || order.status === "delivered") {
      throw new Error("This order has already been paid.");
    }
    if (order.status !== "draft" && order.status !== "pending_payment") {
      throw new Error("This order is no longer eligible for payment.");
    }
    if (order.expiresAt <= now || reservation.status !== "reserved" || reservation.expiresAt <= now) {
      if (reservation.status === "reserved" && reservation.expiresAt <= now) {
        await tx.update(inventoryReservations).set({ status: "expired" })
          .where(eq(inventoryReservations.id, reservation.id));
      }
      await tx.update(orders).set({ status: "expired", updatedAt: now })
        .where(eq(orders.id, order.id));
      throw new Error("This order draft or stock reservation has expired. Return to your bag to start a new checkout.");
    }
    if (!Number.isSafeInteger(order.totalMinor) || order.totalMinor <= 0 || order.totalMinor > MAX_SAFE_MINOR
      || !/^[A-Z]{3}$/.test(order.currency)) {
      throw new Error("This order does not have a supported payable amount and currency.");
    }

    const [sameKey] = await tx.select().from(paymentAttempts)
      .where(and(
        eq(paymentAttempts.orderId, order.id),
        eq(paymentAttempts.idempotencyKey, input.idempotencyKey),
      ))
      .limit(1)
      .for("update");
    if (sameKey) {
      if (sameKey.requestHash !== requestHash) {
        throw new Error("This payment idempotency key was already used for a different request.");
      }
      if (sameKey.providerOrderId && (sameKey.status === "created" || sameKey.status === "authorized")) {
        return { order, attempt: sameKey, replayed: true, needsProviderOrder: false };
      }
      if (sameKey.status === "captured") throw new Error("This order has already been paid.");
      if (sameKey.status === "creation_unknown" || sameKey.status === "creating") {
        throw new Error("Payment creation has an uncertain provider result. Do not retry with a new key; owner reconciliation is required.");
      }
      if (sameKey.status === "failed") throw new Error("This payment attempt failed. Start a new payment attempt.");
    }

    const activeAttempts = await tx.select().from(paymentAttempts)
      .where(and(
        eq(paymentAttempts.orderId, order.id),
      ))
      .orderBy(desc(paymentAttempts.createdAt))
      .limit(10)
      .for("update");
    const active = activeAttempts.find((attempt) =>
      attempt.status === "creating" || attempt.status === "creation_unknown"
      || attempt.status === "created" || attempt.status === "authorized"
    );
    if (active) {
      if (active.providerOrderId && (active.status === "created" || active.status === "authorized")) {
        return { order, attempt: active, replayed: true, needsProviderOrder: false };
      }
      throw new Error("An earlier payment attempt has an uncertain provider result. Do not create a second provider order.");
    }

    const attemptId = randomUUID();
    const providerReceipt = "dag" + attemptId.replaceAll("-", "").slice(0, 32);
    const attempt = {
      id: attemptId,
      orderId: order.id,
      provider: "razorpay" as const,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      providerReceipt,
      providerOrderId: null,
      providerPaymentId: null,
      status: "creating" as MySqlPaymentAttemptStatus,
      amountMinor: order.totalMinor,
      currency: order.currency,
      failureCode: null,
      authorizedAt: null,
      capturedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await tx.insert(paymentAttempts).values(attempt);
    return { order, attempt, replayed: false, needsProviderOrder: true };
  });

  if (!prepared.needsProviderOrder && prepared.attempt.providerOrderId) {
    const configuration = getRazorpaySandboxConfiguration();
    return {
      orderId: prepared.order.id,
      orderNumber: prepared.order.orderNumber,
      providerOrderId: prepared.attempt.providerOrderId,
      keyId: configuration.keyId,
      amountMinor: prepared.attempt.amountMinor,
      currency: prepared.attempt.currency,
      replayed: true,
    };
  }

  try {
    const providerOrder = await createRazorpayOrder({
      amountMinor: prepared.attempt.amountMinor,
      currency: prepared.attempt.currency,
      receipt: prepared.attempt.providerReceipt,
      orderId: prepared.order.id,
      paymentAttemptId: prepared.attempt.id,
    });

    const persisted = await db.transaction(async (tx) => {
      const [reservation] = await tx.select().from(inventoryReservations)
        .where(eq(inventoryReservations.id, prepared.order.reservationId))
        .limit(1)
        .for("update");
      const [order] = await tx.select().from(orders)
        .where(eq(orders.id, prepared.order.id))
        .limit(1)
        .for("update");
      const [attempt] = await tx.select().from(paymentAttempts)
        .where(eq(paymentAttempts.id, prepared.attempt.id))
        .limit(1)
        .for("update");
      if (!reservation || !order || !attempt) throw new Error("The payment session could not be reconciled.");
      const stillOpen = reservation.status === "reserved" && reservation.expiresAt > new Date()
        && order.expiresAt > new Date()
        && (order.status === "draft" || order.status === "pending_payment");
      await tx.update(paymentAttempts).set({
        providerOrderId: providerOrder.id,
        status: "created",
        updatedAt: new Date(),
      }).where(eq(paymentAttempts.id, attempt.id));
      if (!stillOpen) {
        if (reservation.status === "reserved" && reservation.expiresAt <= new Date()) {
          await tx.update(inventoryReservations).set({ status: "expired" })
            .where(eq(inventoryReservations.id, reservation.id));
        }
        if (order.status === "draft" || order.status === "pending_payment") {
          await tx.update(orders).set({ status: "expired", updatedAt: new Date() })
            .where(eq(orders.id, order.id));
        }
        await tx.insert(orderEvents).values({
          id: randomUUID(),
          orderId: order.id,
          actorType: "system",
          actorId: null,
          eventType: "payment_session_created_after_expiry",
          fromStatus: order.status,
          toStatus: order.status === "draft" || order.status === "pending_payment" ? "expired" : order.status,
          note: "A provider order was created but the local order/reservation expired before the payment session could be returned.",
          createdAt: new Date(),
        });
        return false;
      }
      if (order.status === "draft") {
        await tx.update(orders).set({ status: "pending_payment", updatedAt: new Date() })
          .where(eq(orders.id, order.id));
        await tx.insert(orderEvents).values({
          id: randomUUID(),
          orderId: order.id,
          actorType: "system",
          actorId: null,
          eventType: "payment_session_created",
          fromStatus: "draft",
          toStatus: "pending_payment",
          note: "Razorpay test-mode order created from the saved order amount and currency.",
          createdAt: new Date(),
        });
      }
      return true;
    });

    if (!persisted) {
      throw new Error("The stock reservation expired before payment could begin. The provider order will not be shown.");
    }

    const configuration = getRazorpaySandboxConfiguration();
    return {
      orderId: prepared.order.id,
      orderNumber: prepared.order.orderNumber,
      providerOrderId: providerOrder.id,
      keyId: configuration.keyId,
      amountMinor: prepared.attempt.amountMinor,
      currency: prepared.attempt.currency,
      replayed: prepared.replayed,
    };
  } catch (error) {
    const definiteRejection = error && typeof error === "object"
      && "status" in error && typeof (error as { status?: unknown }).status === "number"
      && (error as { status: number }).status >= 400
      && (error as { status: number }).status < 500
      && ![408, 409, 429].includes((error as { status: number }).status);
    await db.update(paymentAttempts).set({
      status: definiteRejection ? "failed" : "creation_unknown",
      failureCode: definiteRejection ? "PROVIDER_REJECTED" : "PROVIDER_RESULT_UNKNOWN",
      updatedAt: new Date(),
    }).where(and(
      eq(paymentAttempts.id, prepared.attempt.id),
      eq(paymentAttempts.status, "creating"),
    ));
    if (error instanceof Error && error.message.startsWith("The stock reservation expired")) throw error;
    throw new Error(definiteRejection
      ? "The payment provider rejected this test-mode order. Review the sandbox configuration and start a new attempt."
      : "The provider result is uncertain. Do not create another payment attempt; owner reconciliation is required.");
  }
}

export async function verifyMySqlRazorpayPayment(input: {
  customerUserId: string;
  orderId: string;
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}): Promise<VerifiedPaymentResult> {
  const configuration = getRazorpaySandboxConfiguration();
  if (!isUuid(input.orderId)) throw new Error("A valid order is required.");
  if (!verifyRazorpayCheckoutSignature({
    providerOrderId: input.providerOrderId,
    providerPaymentId: input.providerPaymentId,
    signature: input.signature,
    keySecret: configuration.keySecret,
  })) {
    throw new Error("The payment signature could not be verified.");
  }

  const [attempt] = await getMySqlDb().select({
    id: paymentAttempts.id,
    providerOrderId: paymentAttempts.providerOrderId,
    amountMinor: paymentAttempts.amountMinor,
    currency: paymentAttempts.currency,
    status: paymentAttempts.status,
  }).from(paymentAttempts)
    .innerJoin(orders, eq(orders.id, paymentAttempts.orderId))
    .where(and(
      eq(paymentAttempts.orderId, input.orderId),
      eq(paymentAttempts.providerOrderId, input.providerOrderId),
      eq(orders.customerUserId, input.customerUserId),
    ))
    .limit(1);
  if (!attempt) throw new Error("The payment session does not belong to this customer order.");

  const payment = await fetchRazorpayPayment(input.providerPaymentId);
  assertProviderPaymentMatches(payment, attempt);
  return (await applyProviderPaymentState({
    providerOrderId: input.providerOrderId,
    payment,
  })) ?? {
    status: "pending",
    orderId: input.orderId,
    message: "The provider payment is awaiting reconciliation.",
  };
}

export async function processRazorpayWebhook(input: {
  eventId: string;
  eventType: string;
  rawBody: string;
  signature: string;
}): Promise<{ status: "processed" | "ignored" | "duplicate" }> {
  const configuration = getRazorpaySandboxConfiguration();
  if (input.rawBody.length > 65_536 || !input.eventId || input.eventId.length > 128
    || !/^[A-Za-z0-9_-]+$/.test(input.eventId)
    || !verifyRazorpayWebhookSignature({
      rawBody: input.rawBody,
      signature: input.signature,
      webhookSecret: configuration.webhookSecret,
    })) {
    throw new Error("The payment webhook signature or event metadata is invalid.");
  }

  let payload: unknown;
  try { payload = JSON.parse(input.rawBody); } catch {
    throw new Error("The payment webhook body is invalid.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("The payment webhook body is invalid.");
  }

  const record = payload as Record<string, unknown>;
  const eventType = typeof record.event === "string" ? record.event : input.eventType;
  const nested = record.payload && typeof record.payload === "object"
    ? record.payload as Record<string, unknown>
    : null;
  const paymentWrapper = nested?.payment && typeof nested.payment === "object"
    ? nested.payment as Record<string, unknown>
    : null;
  const paymentEntity = paymentWrapper?.entity && typeof paymentWrapper.entity === "object"
    ? paymentWrapper.entity as Record<string, unknown>
    : null;
  const paymentId = typeof paymentEntity?.id === "string" ? paymentEntity.id : null;
  const providerOrderId = typeof paymentEntity?.order_id === "string" ? paymentEntity.order_id : null;
  const recognized = ["payment.authorized", "payment.captured", "payment.failed"].includes(eventType);

  let providerPayment: RazorpayPayment | null = null;
  if (recognized) {
    if (!paymentId || !providerOrderId) throw new Error("The payment webhook has no valid payment/order reference.");
    providerPayment = await fetchRazorpayPayment(paymentId);
    if (providerPayment.order_id !== providerOrderId) {
      throw new Error("The payment webhook references a different provider order.");
    }
  }

  const payloadSha256 = createHash("sha256").update(input.rawBody).digest("hex");
  const db = getMySqlDb();
  try {
    return await db.transaction(async (tx) => {
      const snapshot = providerOrderId
        ? await tx.select({
          id: paymentAttempts.id,
          orderId: paymentAttempts.orderId,
        }).from(paymentAttempts)
          .where(and(
            eq(paymentAttempts.provider, "razorpay"),
            eq(paymentAttempts.providerOrderId, providerOrderId),
          ))
          .limit(1)
        : [];
      const attempt = snapshot[0] ?? null;
      await tx.insert(paymentWebhookEvents).values({
        id: randomUUID(),
        provider: "razorpay",
        providerEventId: input.eventId,
        eventType,
        payloadSha256,
        paymentAttemptId: attempt?.id ?? null,
        processingResult: recognized && attempt ? "processed" : "ignored",
        receivedAt: new Date(),
        processedAt: new Date(),
      });

      if (!recognized || !attempt || !providerPayment || !providerOrderId) {
        return { status: "ignored" as const };
      }

      // The event receipt and state transition share one transaction; duplicates cannot apply twice.
      const result = await applyProviderPaymentStateWithinTransaction(tx, {
        attemptId: attempt.id,
        paymentAttemptOrderId: attempt.orderId,
        providerOrderId,
        payment: providerPayment,
        now: new Date(),
      });
      if (!result) {
        await tx.update(paymentWebhookEvents).set({ processingResult: "ignored" })
          .where(eq(paymentWebhookEvents.providerEventId, input.eventId));
        return { status: "ignored" as const };
      }
      return { status: "processed" as const };
    });
  } catch (error) {
    if (isDuplicateEntry(error)) return { status: "duplicate" as const };
    throw error;
  }
}

async function applyProviderPaymentStateWithinTransaction(
  tx: Parameters<Parameters<ReturnType<typeof getMySqlDb>["transaction"]>[0]>[0],
  input: {
    attemptId: string;
    paymentAttemptOrderId: string;
    providerOrderId: string;
    payment: RazorpayPayment;
    now: Date;
  },
): Promise<boolean> {
  // Webhook transaction already holds its receipt lock. Re-read the payment relation and apply the same
  // monotonic state rules used by the customer verification path, without persisting the webhook body.
  const [row] = await tx.select({
    id: paymentAttempts.id,
    orderId: paymentAttempts.orderId,
    reservationId: orders.reservationId,
    providerOrderId: paymentAttempts.providerOrderId,
    amountMinor: paymentAttempts.amountMinor,
    currency: paymentAttempts.currency,
    status: paymentAttempts.status,
  }).from(paymentAttempts)
    .innerJoin(orders, eq(orders.id, paymentAttempts.orderId))
    .where(eq(paymentAttempts.id, input.attemptId))
    .limit(1);
  if (!row || row.orderId !== input.paymentAttemptOrderId || row.providerOrderId !== input.providerOrderId) return false;

  const items = await tx.select({
    variantId: inventoryReservationItems.variantId,
    quantity: inventoryReservationItems.quantity,
  }).from(inventoryReservationItems)
    .where(eq(inventoryReservationItems.reservationId, row.reservationId))
    .orderBy(asc(inventoryReservationItems.variantId));
  if (items.length === 0) throw new Error("The saved stock reservation has no item rows.");

  const variantIds = items.map((item) => item.variantId);
  const variants = await tx.select().from(productVariants)
    .where(inArray(productVariants.id, variantIds))
    .orderBy(asc(productVariants.id))
    .for("update");
  if (variants.length !== variantIds.length) throw new Error("Reserved product options are missing.");
  const productIds = [...new Set(variants.map((variant) => variant.productId))].sort();
  const lockedProducts = await tx.select({ id: products.id }).from(products)
    .where(inArray(products.id, productIds))
    .orderBy(asc(products.id))
    .for("update");
  if (lockedProducts.length !== productIds.length) throw new Error("A reserved product is missing.");

  const [reservation] = await tx.select().from(inventoryReservations)
    .where(eq(inventoryReservations.id, row.reservationId)).limit(1).for("update");
  const [order] = await tx.select().from(orders)
    .where(eq(orders.id, row.orderId)).limit(1).for("update");
  const [attempt] = await tx.select().from(paymentAttempts)
    .where(eq(paymentAttempts.id, row.id)).limit(1).for("update");
  if (!reservation || !order || !attempt) throw new Error("Payment state could not be reconciled.");
  assertProviderPaymentMatches(input.payment, attempt);

  if (attempt.status === "captured" || attempt.status === "captured_after_expiry") return true;

  if (input.payment.status === "captured" && input.payment.captured) {
    const open = reservation.status === "reserved" && reservation.expiresAt > input.now
      && order.expiresAt > input.now
      && (order.status === "draft" || order.status === "pending_payment");
    const stockById = new Map(variants.map((variant) => [variant.id, variant]));
    const stockValid = items.every((item) => (stockById.get(item.variantId)?.stockQuantity ?? -1) >= item.quantity);
    if (!open || !stockValid) {
      if (reservation.status === "reserved" && reservation.expiresAt <= input.now) {
        await tx.update(inventoryReservations).set({ status: "expired" }).where(eq(inventoryReservations.id, reservation.id));
      }
      const nextStatus = order.status === "draft" || order.status === "pending_payment" ? "expired" : order.status;
      if (nextStatus !== order.status) {
        await tx.update(orders).set({ status: "expired", updatedAt: input.now }).where(eq(orders.id, order.id));
      }
      await tx.update(paymentAttempts).set({
        status: "captured_after_expiry",
        providerPaymentId: input.payment.id,
        capturedAt: input.now,
        failureCode: stockValid ? "RESERVATION_CLOSED" : "RESERVED_STOCK_MISMATCH",
        updatedAt: input.now,
      }).where(eq(paymentAttempts.id, attempt.id));
      await tx.insert(orderEvents).values({
        id: randomUUID(), orderId: order.id, actorType: "system", actorId: null,
        eventType: "payment_captured_after_reservation_closed",
        fromStatus: order.status, toStatus: nextStatus,
        note: "Provider confirmed capture after the order or stock reservation became unavailable. Fulfilment is blocked pending owner review.",
        createdAt: input.now,
      });
      return true;
    }

    for (const item of items) {
      const variant = stockById.get(item.variantId)!;
      await tx.insert(inventoryMovements).values({
        id: randomUUID(), variantId: item.variantId, quantityDelta: -item.quantity,
        reason: "Paid order reservation consumed",
        referenceKey: "reservation:" + reservation.id + ":" + item.variantId,
        actorId: null, createdAt: input.now,
      });
      await tx.update(productVariants).set({
        stockQuantity: variant.stockQuantity - item.quantity, updatedAt: input.now,
      }).where(eq(productVariants.id, item.variantId));
    }
    await tx.update(inventoryReservations).set({ status: "consumed" }).where(eq(inventoryReservations.id, reservation.id));
    await tx.update(paymentAttempts).set({
      status: "captured", providerPaymentId: input.payment.id, capturedAt: input.now,
      failureCode: null, updatedAt: input.now,
    }).where(eq(paymentAttempts.id, attempt.id));
    await tx.update(orders).set({ status: "paid", updatedAt: input.now }).where(eq(orders.id, order.id));
    await tx.insert(orderEvents).values({
      id: randomUUID(), orderId: order.id, actorType: "system", actorId: null,
      eventType: "payment_captured", fromStatus: order.status, toStatus: "paid",
      note: "Webhook receipt was verified and provider payment state, order reference, amount and currency were rechecked.",
      createdAt: input.now,
    });
    return true;
  }

  if (input.payment.status === "authorized" && !input.payment.captured) {
    if (order.status === "draft" && order.expiresAt > input.now
      && reservation.status === "reserved" && reservation.expiresAt > input.now) {
      await tx.update(orders).set({ status: "pending_payment", updatedAt: input.now }).where(eq(orders.id, order.id));
      await tx.insert(orderEvents).values({
        id: randomUUID(), orderId: order.id, actorType: "system", actorId: null,
        eventType: "payment_authorized", fromStatus: "draft", toStatus: "pending_payment",
        note: "Authorization is not capture. Fulfilment remains blocked.",
        createdAt: input.now,
      });
    }
    await tx.update(paymentAttempts).set({
      status: "authorized", providerPaymentId: input.payment.id,
      authorizedAt: attempt.authorizedAt ?? input.now, updatedAt: input.now,
    }).where(eq(paymentAttempts.id, attempt.id));
    return true;
  }

  if (input.payment.status === "failed") {
    await tx.update(paymentAttempts).set({
      status: "failed", providerPaymentId: input.payment.id,
      failureCode: "PROVIDER_PAYMENT_FAILED", updatedAt: input.now,
    }).where(eq(paymentAttempts.id, attempt.id));
    await tx.insert(orderEvents).values({
      id: randomUUID(), orderId: order.id, actorType: "system", actorId: null,
      eventType: "payment_failed", fromStatus: order.status, toStatus: order.status,
      note: "The provider reports a failed payment. No fulfilment action was taken.",
      createdAt: input.now,
    });
    return true;
  }
  return true;
}
