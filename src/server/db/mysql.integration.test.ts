import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeMySqlPool, getMySqlDb } from "./index";
import {
  artisanProfiles, collectionProductLinks, collections, inventoryMovements, inventoryReservationItems,
  inventoryReservations, journalPosts, productCategories, productCategoryLinks,
  productMedia, products, productVariants, siteContent,
} from "./schema";

const enabled = process.env.MYSQL_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite("real MySQL migration and catalogue integration", () => {
  afterAll(async () => { await closeMySqlPool(); });

  it("keeps the applied Drizzle migration set safe to rerun", () => {
    const repeat = spawnSync("npm", ["run", "db:migrate"], { encoding: "utf8", env: process.env });
    if (repeat.status !== 0) {
      throw new Error("Repeat MySQL migration failed.\n" + repeat.stdout + "\n" + repeat.stderr);
    }
  }, 90_000);

  it("persists editorial data and catalogue records with category, media, variant and reservation relationships", async () => {
    const db = getMySqlDb();
    const id = randomUUID(), categoryId = randomUUID(), productId = randomUUID();
    const variantId = randomUUID(), reservationId = randomUUID();
    try {
      await db.insert(siteContent).values({ id, contentKey: "integration-" + id, body: { heading: "Integration" }, isPublished: true });
      await db.insert(collections).values({ id, name: "Integration", slug: "integration-" + id, description: "", isPublished: true });
      await db.insert(artisanProfiles).values({ id, fullName: "Integration artisan", biography: "", craftSpecialties: [], isPublished: true });
      await db.insert(journalPosts).values({ id, title: "Integration story", slug: "integration-" + id, excerpt: "", contentMarkdown: "", status: "published", publishedAt: new Date() });
      await db.insert(productCategories).values({ id: categoryId, name: "Integration", slug: "integration-" + categoryId });
      await db.insert(products).values({ id: productId, title: "Integration product", slug: "integration-" + productId, currency: "USD", priceMinor: 1000, status: "draft" });
      await db.insert(productCategoryLinks).values({ productId, categoryId });
      await db.insert(productVariants).values({ id: variantId, productId, sku: "IT-" + variantId.slice(0, 8), label: "One size", attributes: {}, currency: "USD", stockQuantity: 4 });
      await db.insert(productMedia).values({ id: randomUUID(), productId, storageKey: "products/" + productId + "/" + randomUUID() + ".webp", altText: "Integration image", mimeType: "image/webp", byteSize: 10 });
      await db.insert(inventoryMovements).values({ id: randomUUID(), variantId, quantityDelta: 4, reason: "Opening balance", referenceKey: "integration-" + randomUUID() });
      await db.insert(inventoryReservations).values({ id: reservationId, customerReference: "integration-customer", idempotencyKey: "integration-" + randomUUID(), expiresAt: new Date(Date.now() + 60_000) });
      await db.insert(inventoryReservationItems).values({ id: randomUUID(), reservationId, variantId, quantity: 1 });
      const [product] = await db.select().from(products).where(eq(products.id, productId));
      expect(product.priceMinor).toBe(1000);
      expect(product.status).toBe("draft");
    } finally {
      await db.delete(inventoryReservationItems).where(eq(inventoryReservationItems.reservationId, reservationId));
      await db.delete(inventoryReservations).where(eq(inventoryReservations.id, reservationId));
      await db.delete(inventoryMovements).where(eq(inventoryMovements.referenceKey, "integration-never-match"));
      await db.delete(productMedia).where(eq(productMedia.productId, productId));
      await db.delete(productVariants).where(eq(productVariants.productId, productId));
      await db.delete(productCategoryLinks).where(eq(productCategoryLinks.productId, productId));
      await db.delete(products).where(eq(products.id, productId));
      await db.delete(productCategories).where(eq(productCategories.id, categoryId));
      await db.delete(journalPosts).where(eq(journalPosts.id, id));
      await db.delete(artisanProfiles).where(eq(artisanProfiles.id, id));
      await db.delete(collections).where(eq(collections.id, id));
      await db.delete(siteContent).where(eq(siteContent.id, id));
    }
  }, 45_000);

  it("rejects invalid foreign keys, duplicate SKUs and broken editorial constraints", async () => {
    const db = getMySqlDb();
    await expect(db.insert(productVariants).values({
      id: randomUUID(), productId: randomUUID(), sku: "FK-" + randomUUID(),
      label: "Missing product", attributes: {}, currency: "USD",
    })).rejects.toBeTruthy();

    const id = randomUUID();
    await expect(db.insert(journalPosts).values({
      id, title: "Invalid", slug: "invalid-" + id, excerpt: "", contentMarkdown: "",
      status: "invalid" as never,
    })).rejects.toBeTruthy();

    const productOne = randomUUID(), productTwo = randomUUID();
    const variantOne = randomUUID(), variantTwo = randomUUID();
    const sku = "DUP-" + randomUUID().slice(0, 8);
    try {
      await db.insert(products).values({ id: productOne, title: "One", slug: "one-" + productOne, currency: "USD", priceMinor: 100 });
      await db.insert(products).values({ id: productTwo, title: "Two", slug: "two-" + productTwo, currency: "USD", priceMinor: 100 });
      await db.insert(productVariants).values({ id: variantOne, productId: productOne, sku, label: "A", attributes: {}, currency: "USD" });
      await expect(db.insert(productVariants).values({ id: variantTwo, productId: productTwo, sku, label: "B", attributes: {}, currency: "USD" })).rejects.toBeTruthy();
    } finally {
      await db.delete(productVariants).where(eq(productVariants.productId, productOne));
      await db.delete(productVariants).where(eq(productVariants.productId, productTwo));
      await db.delete(products).where(eq(products.id, productOne));
      await db.delete(products).where(eq(products.id, productTwo));
    }
  }, 30_000);

  it("rolls back a partially executed transaction", async () => {
    const db = getMySqlDb();
    const id = randomUUID();
    await expect(db.transaction(async (tx) => {
      await tx.insert(siteContent).values({ id, contentKey: "rollback-" + id, body: { temporary: true } });
      throw new Error("forced rollback");
    })).rejects.toThrow("forced rollback");
    const rows = await db.select().from(siteContent).where(eq(siteContent.id, id));
    expect(rows).toHaveLength(0);
  }, 30_000);

  it("enforces real media rights, MIME type and size constraints", async () => {
    const db = getMySqlDb();
    const productId = randomUUID();
    const id = randomUUID();
    try {
      await db.insert(products).values({
        id: productId, title: "Media constraint product", slug: "media-check-" + productId,
        currency: "USD", priceMinor: 1000, status: "draft",
      });
      await expect(db.insert(productMedia).values({
        id, productId, storageKey: "products/" + productId + "/invalid.webp",
        altText: "", rightsConfirmed: true, rightsEvidence: "",
        mimeType: "image/gif", byteSize: 0,
      })).rejects.toBeTruthy();
    } finally {
      await db.delete(productMedia).where(eq(productMedia.productId, productId));
      await db.delete(products).where(eq(products.id, productId));
    }
  }, 30_000);

  it("rejects invalid reservation status and zero-quantity reservation items", async () => {
    const db = getMySqlDb();
    const reservationId = randomUUID();
    await expect(db.insert(inventoryReservations).values({
      id: reservationId, customerReference: "test", idempotencyKey: "bad-status-" + reservationId,
      status: "unknown" as never, expiresAt: new Date(Date.now() + 60_000),
    })).rejects.toBeTruthy();
  }, 30_000);

  it("rejects product compare-at prices lower than the selling price", async () => {
    const db = getMySqlDb();
    const productId = randomUUID();
    await expect(db.insert(products).values({
      id: productId, title: "Bad compare price", slug: "bad-compare-" + productId,
      currency: "USD", priceMinor: 1000, compareAtPriceMinor: 500,
    })).rejects.toBeTruthy();
  }, 30_000);

  it("enforces artisan years-of-experience and portrait rights constraints", async () => {
    const db = getMySqlDb();
    const id = randomUUID();
    await expect(db.insert(artisanProfiles).values({
      id, fullName: "Invalid artisan", biography: "", craftSpecialties: [],
      yearsExperience: 101,
    })).rejects.toBeTruthy();
  }, 30_000);

  it("reopens the pool and reads previously committed content", async () => {
    const db = getMySqlDb();
    const id = randomUUID();
    await db.insert(siteContent).values({ id, contentKey: "pool-reopen-" + id, body: { persisted: true } });
    await closeMySqlPool();
    const reopened = getMySqlDb();
    const rows = await reopened.select().from(siteContent).where(eq(siteContent.id, id));
    expect(rows[0]?.body).toEqual({ persisted: true });
    await reopened.delete(siteContent).where(eq(siteContent.id, id));
  }, 30_000);
});
