import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { closeMySqlPool, getMySqlDb } from "./index";
import {
  expireVariantStockReservations, reserveVariantStock,
  releaseVariantStockReservation, consumeVariantStockReservation, adjustVariantInventory,
} from "../catalogue/inventory";
import { commitLocalCatalogueCsv, previewLocalCatalogueCsv } from "../catalogue/import-csv";
import {
  commitLocalProductImages,
  previewLocalProductImageImport,
  PRODUCT_IMAGE_IMPORT_CONFIRMATION,
} from "../catalogue/import-product-images";
import { readProductMedia, removeProductMedia } from "../media/product-storage";
import {
  getAvailableVariantQuantity, getPublishedProductBySlug, isPublicProductMedia, listPublishedProducts,
} from "../catalogue/repository";
import {
  adminSessions, adminUsers, artisanProfiles, collections, inventoryMovements, inventoryReservationItems, catalogueImportBatches,
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
    const movementReferenceKey = "integration-" + randomUUID();
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
      await db.insert(inventoryMovements).values({ id: randomUUID(), variantId, quantityDelta: 4, reason: "Opening balance", referenceKey: movementReferenceKey });
      await db.insert(inventoryReservations).values({ id: reservationId, customerReference: "integration-customer", idempotencyKey: "integration-" + randomUUID(), expiresAt: new Date(Date.now() + 60_000) });
      await db.insert(inventoryReservationItems).values({ id: randomUUID(), reservationId, variantId, quantity: 1 });
      const [product] = await db.select().from(products).where(eq(products.id, productId));
      expect(product.priceMinor).toBe(1000);
      expect(product.status).toBe("draft");
    } finally {
      await db.delete(inventoryReservationItems).where(eq(inventoryReservationItems.reservationId, reservationId));
      await db.delete(inventoryReservations).where(eq(inventoryReservations.id, reservationId));
      await db.delete(inventoryMovements).where(eq(inventoryMovements.referenceKey, movementReferenceKey));
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


  it("reads only published MySQL products with rights-approved images and ordered variants", async () => {
    const db = getMySqlDb();
    const id = randomUUID();
    const categoryId = randomUUID();
    const variantId = randomUUID();
    const imageId = randomUUID();
    const slug = "published-mysql-" + id;
    const storageKey = "products/" + id + "/" + randomUUID() + ".webp";
    try {
      await db.insert(products).values({
        id, title: "Published MySQL piece", slug, shortDescription: "A verified short description",
        description: "Product details", currency: "USD", priceMinor: 2500,
        status: "published", materials: ["Cotton"], sizes: ["M"], measurements: { chest: "40 cm" },
        conditionNotes: "Good condition", provenance: "Gallery-supplied provenance", craftStory: "Merchant-supplied story",
      });
      await db.insert(productCategories).values({ id: categoryId, name: "Textiles", slug: "textiles-" + id });
      await db.insert(productCategoryLinks).values({ productId: id, categoryId });
      await db.insert(productVariants).values({
        id: variantId, productId: id, sku: "READ-" + id.slice(0, 8), label: "Medium",
        attributes: { size: "M" }, currency: "USD", stockQuantity: 3, isActive: true,
      });
      await db.insert(productMedia).values({
        id: imageId, productId: id, storageKey, altText: "Front view of verified textile",
        rightsConfirmed: true, rightsEvidence: "Owner photo permission confirmed in test fixture",
        mimeType: "image/webp", byteSize: 1200, position: 0, isPrimary: true,
      });
      const listed = await listPublishedProducts({ search: "Published MySQL", categorySlug: "textiles-" + id, limit: 10 });
      expect(listed).toHaveLength(1);
      expect(listed[0].slug).toBe(slug);
      expect(listed[0].priceMinor).toBe(2500);
      expect(listed[0].materials).toEqual(["Cotton"]);
      expect(listed[0].variants?.[0]?.id).toBe(variantId);
      expect(listed[0].image).toBe("/product-media/" + storageKey);
      const detail = await getPublishedProductBySlug(slug);
      expect(detail?.name).toBe("Published MySQL piece");
      expect(await isPublicProductMedia(storageKey)).toBe(true);
      await db.update(productMedia).set({ rightsConfirmed: false, rightsEvidence: "" }).where(eq(productMedia.id, imageId));
      expect(await isPublicProductMedia(storageKey)).toBe(false);
      await db.update(products).set({ status: "draft" }).where(eq(products.id, id));
      expect(await getPublishedProductBySlug(slug)).toBeNull();
    } finally {
      await db.delete(productMedia).where(eq(productMedia.productId, id));
      await db.delete(productVariants).where(eq(productVariants.productId, id));
      await db.delete(productCategoryLinks).where(eq(productCategoryLinks.productId, id));
      await db.delete(products).where(eq(products.id, id));
      await db.delete(productCategories).where(eq(productCategories.id, categoryId));
    }
  }, 45_000);

  it("reserves stock idempotently, prevents overselling, consumes once and releases stock", async () => {
    const db = getMySqlDb();
    const productId = randomUUID();
    const variantId = randomUUID();
    const slug = "reservation-" + productId;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    const key = "reservation-idem-" + randomUUID();
    const request = {
      customerReference: "mysql-integration-customer",
      idempotencyKey: key,
      items: [{ variantId, quantity: 4 }],
      expiresAt,
    };
    try {
      await db.insert(products).values({
        id: productId, title: "Reservation product", slug, currency: "USD",
        priceMinor: 500, status: "published",
      });
      await db.insert(productVariants).values({
        id: variantId, productId, sku: "RES-" + productId.slice(0, 8),
        label: "Standard", attributes: {}, currency: "USD", stockQuantity: 5, isActive: true,
      });
      const reservation = await reserveVariantStock(request, now);
      const sameReservation = await reserveVariantStock(request, now);
      expect(sameReservation.reservationId).toBe(reservation.reservationId);
      expect(await getAvailableVariantQuantity(variantId)).toBe(1);
      await expect(reserveVariantStock({
        ...request, idempotencyKey: key + "-oversell", items: [{ variantId, quantity: 2 }],
      }, now)).rejects.toThrow("Insufficient available stock");
      await expect(adjustVariantInventory({
        variantId, quantityDelta: -2, reason: "stocktake",
        referenceKey: "cannot-cross-reservation-" + productId, actorId: null,
      }, now)).rejects.toThrow("reserved quantity");

      expect(await releaseVariantStockReservation(reservation.reservationId, now)).toBe("released");
      expect(await getAvailableVariantQuantity(variantId)).toBe(5);
      const consumeRequest = {
        ...request, idempotencyKey: key + "-consume", items: [{ variantId, quantity: 5 }],
      };
      const consumeReservation = await reserveVariantStock(consumeRequest, now);
      expect(await consumeVariantStockReservation(consumeReservation.reservationId, now)).toBe("consumed");
      expect(await consumeVariantStockReservation(consumeReservation.reservationId, now)).toBe("consumed");
      const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, variantId));
      expect(variant.stockQuantity).toBe(0);
      const movements = await db.select().from(inventoryMovements)
        .where(eq(inventoryMovements.variantId, variantId));
      expect(movements.filter((movement) => movement.reason === "Reservation consumed")).toHaveLength(1);
    } finally {
      await db.delete(inventoryReservationItems).where(eq(inventoryReservationItems.variantId, variantId));
      await db.delete(inventoryReservations).where(eq(inventoryReservations.customerReference, "mysql-integration-customer"));
      await db.delete(inventoryMovements).where(eq(inventoryMovements.variantId, variantId));
      await db.delete(productVariants).where(eq(productVariants.id, variantId));
      await db.delete(products).where(eq(products.id, productId));
    }
  }, 45_000);

  it("serializes concurrent stock reservations and expires old holds", async () => {
    const db = getMySqlDb();
    const productId = randomUUID();
    const variantId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    try {
      await db.insert(products).values({
        id: productId, title: "Concurrent reservation product",
        slug: "concurrent-reservation-" + productId,
        currency: "USD", priceMinor: 1000, status: "published",
      });
      await db.insert(productVariants).values({
        id: variantId, productId, sku: "CON-" + productId.slice(0, 8),
        label: "One size", attributes: {}, currency: "USD", stockQuantity: 5, isActive: true,
      });
      const results = await Promise.allSettled([1, 2].map((index) => reserveVariantStock({
        customerReference: "concurrent-customer-" + index,
        idempotencyKey: "concurrent-idempotency-" + productId + "-" + index,
        items: [{ variantId, quantity: 4 }],
        expiresAt,
      }, now)));
      const successful = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof reserveVariantStock>>> =>
        result.status === "fulfilled");
      expect(successful).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

      const shortHold = await reserveVariantStock({
        customerReference: "expiry-customer",
        idempotencyKey: "expiry-idempotency-" + productId,
        items: [{ variantId, quantity: 1 }],
        expiresAt,
      }, now);
      const expiredCount = await expireVariantStockReservations(100, new Date(now.getTime() + 11 * 60 * 1000));
      expect(expiredCount).toBe(2);
      const expiredRecords = await db.select().from(inventoryReservations)
        .where(sql`idempotency_key IN (${"concurrent-idempotency-" + productId + "-1"}, ${"concurrent-idempotency-" + productId + "-2"}, ${"expiry-idempotency-" + productId})`);
      expect(expiredRecords.every((record) => record.status === "expired")).toBe(true);
      expect(shortHold.status).toBe("reserved");
    } finally {
      await db.delete(inventoryReservationItems).where(eq(inventoryReservationItems.variantId, variantId));
      await db.delete(inventoryReservations).where(sql`idempotency_key LIKE ${"concurrent-idempotency-" + productId + "%"} OR idempotency_key = ${"expiry-idempotency-" + productId}`);
      await db.delete(productVariants).where(eq(productVariants.id, variantId));
      await db.delete(products).where(eq(products.id, productId));
    }
  }, 45_000);

  it("enforces one-of-a-kind stock and reservations across sibling variants", async () => {
    const db = getMySqlDb();
    const productId = randomUUID();
    const firstVariantId = randomUUID();
    const secondVariantId = randomUUID();
    const customerReference = "one-of-a-kind-customer-" + productId;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 20 * 60 * 1000);
    try {
      await db.insert(products).values({
        id: productId,
        title: "One-of-a-kind multi-option piece",
        slug: "one-of-a-kind-" + productId,
        currency: "USD",
        priceMinor: 1000,
        status: "published",
        isOneOfAKind: true,
      });
      await db.insert(productVariants).values([
        {
          id: firstVariantId,
          productId,
          sku: "OOAK-A-" + productId.slice(0, 8),
          label: "Option A",
          attributes: { option: "A" },
          currency: "USD",
          stockQuantity: 1,
          isActive: true,
        },
        {
          id: secondVariantId,
          productId,
          sku: "OOAK-B-" + productId.slice(0, 8),
          label: "Option B",
          attributes: { option: "B" },
          currency: "USD",
          stockQuantity: 0,
          isActive: true,
        },
      ]);

      const firstHold = await reserveVariantStock({
        customerReference,
        idempotencyKey: "one-of-a-kind-first-" + productId,
        items: [{ variantId: firstVariantId, quantity: 1 }],
        expiresAt,
      }, now);
      expect(firstHold.status).toBe("reserved");

      // A sibling variant cannot be stocked while the only physical unit is
      // reserved against another variant of this same one-of-a-kind product.
      await expect(adjustVariantInventory({
        variantId: secondVariantId,
        quantityDelta: 1,
        reason: "attempt duplicate one-of-a-kind option",
        referenceKey: "one-of-a-kind-adjust-" + productId,
        actorId: null,
      }, now)).rejects.toThrow("one-of-a-kind product");

      // Simulate an out-of-band stock reclassification of a legacy/manual row.
      // The product still has one physical unit, but its active hold belongs to
      // the sibling variant. Product-level reservation accounting must fail closed.
      await db.update(productVariants).set({ stockQuantity: 0 })
        .where(eq(productVariants.id, firstVariantId));
      await db.update(productVariants).set({ stockQuantity: 1 })
        .where(eq(productVariants.id, secondVariantId));

      await expect(reserveVariantStock({
        customerReference: customerReference + "-sibling",
        idempotencyKey: "one-of-a-kind-sibling-" + productId,
        items: [{ variantId: secondVariantId, quantity: 1 }],
        expiresAt,
      }, now)).rejects.toThrow("Insufficient available stock");
    } finally {
      const testReservations = await db.select({ id: inventoryReservations.id })
        .from(inventoryReservations)
        .where(inArray(inventoryReservations.customerReference, [
          customerReference,
          customerReference + "-sibling",
        ]));
      for (const reservation of testReservations) {
        await db.delete(inventoryReservationItems)
          .where(eq(inventoryReservationItems.reservationId, reservation.id));
      }
      await db.delete(inventoryReservations).where(inArray(inventoryReservations.customerReference, [
        customerReference,
        customerReference + "-sibling",
      ]));
      await db.delete(productVariants).where(inArray(productVariants.id, [firstVariantId, secondVariantId]));
      await db.delete(products).where(eq(products.id, productId));
    }
  }, 45_000);

  it("stores only local owner credentials and hashed expiring session tokens", async () => {
    const db = getMySqlDb();
    const ownerId = randomUUID();
    const sessionId = randomUUID();
    const email = "owner-" + ownerId + "@example.test";
    const tokenHash = randomUUID().replace(/-/g, "").padEnd(64, "a").slice(0, 64);
    try {
      await db.insert(adminUsers).values({
        id: ownerId,
        email,
        displayName: "Integration Owner",
        passwordHash: "scrypt$" + "a".repeat(32) + "$" + "b".repeat(128),
        role: "owner",
        isActive: true,
      });
      await db.insert(adminSessions).values({
        id: sessionId,
        adminUserId: ownerId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      const [session] = await db.select({
        email: adminUsers.email,
        role: adminUsers.role,
        tokenHash: adminSessions.tokenHash,
      }).from(adminSessions)
        .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminUserId))
        .where(eq(adminSessions.id, sessionId));
      expect(session?.email).toBe(email);
      expect(session?.role).toBe("owner");
      expect(session?.tokenHash).toBe(tokenHash);
      await db.delete(adminUsers).where(eq(adminUsers.id, ownerId));
      const remaining = await db.select().from(adminSessions).where(eq(adminSessions.id, sessionId));
      expect(remaining).toHaveLength(0);
    } finally {
      await db.delete(adminSessions).where(eq(adminSessions.id, sessionId));
      await db.delete(adminUsers).where(eq(adminUsers.id, ownerId));
    }
  }, 30_000);

  it("previews and commits a local CSV as drafts with opening inventory exactly once", async () => {
    const db = getMySqlDb();
    const id = randomUUID();
    const categoryId = randomUUID();
    const slug = "csv-import-" + id;
    const categorySlug = "csv-category-" + id;
    const sku = "CSV-" + id.slice(0, 8);
    const csv = [
      "slug,title,short_description,description,category_slug,price,currency,compare_at_price,sku,quantity_on_hand,materials,sizes,measurements,condition_notes,provenance,craft_story",
      [slug, "Imported test textile", "Verified short detail", "Merchant supplied description", categorySlug, "12.50", "USD", "", sku, "3", "Cotton|Silk", "M|L", '"{""chest"":""40 cm""}"', "Good condition", "Owner supplied provenance", "Merchant supplied story"].join(","),
    ].join("\n");
    const bytes = new TextEncoder().encode(csv);
    const sha = createHash("sha256").update(bytes).digest("hex");
    try {
      await db.insert(productCategories).values({
        id: categoryId, name: "CSV test category", slug: categorySlug, description: "Integration category",
      });
      const preview = await previewLocalCatalogueCsv("import.csv", bytes);
      expect(preview.canCommit).toBe(true);
      expect(preview.totalRows).toBe(1);
      expect(preview.validRows).toBe(1);
      expect(preview.productsInTarget).toBe(0);
      const before = await db.select().from(products).where(eq(products.slug, slug));
      expect(before).toHaveLength(0);

      await expect(commitLocalCatalogueCsv("import.csv", bytes, "incorrect-confirmation")).rejects.toThrow("explicit");
      const result = await commitLocalCatalogueCsv("import.csv", bytes, "IMPORT_TO_LOCAL_MYSQL");
      expect(result.productsCreated).toBe(1);
      expect(result.stockUnitsAdded).toBe(3);
      const [product] = await db.select().from(products).where(eq(products.slug, slug));
      expect(product.status).toBe("draft");
      expect(product.priceMinor).toBe(1250);
      const [variant] = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
      expect(variant.sku).toBe(sku.toUpperCase());
      expect(variant.label).toBe("Standard");
      expect(variant.stockQuantity).toBe(3);
      const [movement] = await db.select().from(inventoryMovements).where(eq(inventoryMovements.variantId, variant.id));
      expect(movement.quantityDelta).toBe(3);
      expect(movement.reason).toBe("CSV opening balance");
      expect(await db.select().from(productMedia).where(eq(productMedia.productId, product.id))).toHaveLength(0);
      const [batch] = await db.select().from(catalogueImportBatches)
        .where(eq(catalogueImportBatches.sourceSha256, sha));
      expect(batch.productsCreated).toBe(1);
      await expect(commitLocalCatalogueCsv("import.csv", bytes, "IMPORT_TO_LOCAL_MYSQL")).rejects.toThrow("not ready to commit");
    } finally {
      const [product] = await db.select().from(products).where(eq(products.slug, slug));
      if (product) {
        const variantsForProduct = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
        for (const variant of variantsForProduct) {
          await db.delete(inventoryMovements).where(eq(inventoryMovements.variantId, variant.id));
        }
        await db.delete(productCategoryLinks).where(eq(productCategoryLinks.productId, product.id));
        await db.delete(productVariants).where(eq(productVariants.productId, product.id));
        await db.delete(productMedia).where(eq(productMedia.productId, product.id));
        await db.delete(products).where(eq(products.id, product.id));
      }
      await db.delete(catalogueImportBatches).where(eq(catalogueImportBatches.sourceSha256, sha));
      await db.delete(productCategories).where(eq(productCategories.id, categoryId));
    }
  }, 60_000);

  it("imports native Etsy listings as distinct drafts with tags, source images and safe SKU handling", async () => {
    const db = getMySqlDb();
    const headers = ["TITLE", "DESCRIPTION", "PRICE", "CURRENCY_CODE", "QUANTITY", "TAGS", "MATERIALS", "IMAGE1", "SKU"];
    const rows = [
      ["One Of A Kind Tribal Jacket", "First piece description", "980.00", "USD", "1", "tribal jacket,mirror work", "Wool,Cotton,Mirror", "https://i.etsystatic.com/22307146/first.jpg", "DUP-51"],
      ["One Of A Kind Tribal Jacket", "Second piece description", "880", "USD", "1", "folk jacket,handmade", "Wool,Cotton", "https://i.etsystatic.com/22307146/second.jpg", "DUP-51"],
    ];
    const quote = (value: string) => '"' + value.replace(/"/g, '""') + '"';
    const bytes = new TextEncoder().encode([
      headers.join(","),
      ...rows.map((row) => row.map(quote).join(",")),
    ].join("\r\n"));
    const sha = createHash("sha256").update(bytes).digest("hex");
    let importedSlugs: string[] = [];
    try {
      const preview = await previewLocalCatalogueCsv("EtsyListingsDownload.csv", bytes);
      expect(preview.sourceType).toBe("etsy");
      expect(preview.canCommit).toBe(true);
      expect(preview.totalRows).toBe(2);
      expect(preview.rows.every((row) => row.sku === null)).toBe(true);
      expect(preview.rows.every((row) => row.imageCount === 1 && row.tagCount === 2)).toBe(true);
      expect(preview.warnings.join(" ")).toContain("SKU values are duplicated");
      importedSlugs = preview.rows.map((row) => row.slug);

      const result = await commitLocalCatalogueCsv("EtsyListingsDownload.csv", bytes, "IMPORT_TO_LOCAL_MYSQL");
      expect(result.productsCreated).toBe(2);
      expect(result.stockUnitsAdded).toBe(2);
      const imported = await db.select().from(products).where(inArray(products.slug, importedSlugs));
      expect(imported).toHaveLength(2);
      expect(imported.every((product) => product.status === "draft")).toBe(true);
      expect(imported.every((product) => product.currency === "USD" && product.priceMinor > 0)).toBe(true);
      expect(imported.every((product) => product.tags?.length === 2)).toBe(true);
      expect(imported.every((product) => product.sourceMetadata?.provider === "etsy")).toBe(true);
      expect(imported.every((product) => Array.isArray(product.sourceMetadata?.imageUrls))).toBe(true);
      expect(imported.every((product) => product.sourceMetadata?.sourceName === "EtsyListingsDownload.csv")).toBe(true);
      const variants = await db.select().from(productVariants)
        .where(inArray(productVariants.productId, imported.map((product) => product.id)));
      expect(variants).toHaveLength(2);
      expect(variants.every((variant) => variant.sku === null && variant.stockQuantity === 1)).toBe(true);
      expect(await db.select().from(productMedia)
        .where(inArray(productMedia.productId, imported.map((product) => product.id)))).toHaveLength(0);
      const [batch] = await db.select().from(catalogueImportBatches).where(eq(catalogueImportBatches.sourceSha256, sha));
      expect(batch.rowCount).toBe(2);
      expect((batch.report as Record<string, unknown>).source_type).toBe("etsy");
    } finally {
      if (importedSlugs.length) {
        const imported = await db.select().from(products).where(inArray(products.slug, importedSlugs));
        for (const product of imported) {
          const variants = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
          for (const variant of variants) {
            await db.delete(inventoryMovements).where(eq(inventoryMovements.variantId, variant.id));
          }
          await db.delete(productCategoryLinks).where(eq(productCategoryLinks.productId, product.id));
          await db.delete(productVariants).where(eq(productVariants.productId, product.id));
          await db.delete(productMedia).where(eq(productMedia.productId, product.id));
          await db.delete(products).where(eq(products.id, product.id));
        }
      }
      await db.delete(catalogueImportBatches).where(eq(catalogueImportBatches.sourceSha256, sha));
    }
  }, 60_000);

  it("matches exact draft slugs, imports private product photos and is idempotent", async () => {
    const db = getMySqlDb();
    const productId = randomUUID();
    const slug = "image-intake-" + productId;
    const intakeRoot = await mkdtemp(join(tmpdir(), "dag-image-intake-"));
    const mediaRoot = await mkdtemp(join(tmpdir(), "dag-private-media-"));
    const folder = join(intakeRoot, slug);
    const previousMediaRoot = process.env.MEDIA_STORAGE_ROOT;
    await mkdir(folder, { recursive: true });
    process.env.MEDIA_STORAGE_ROOT = mediaRoot;

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    await writeFile(join(folder, "01-primary.jpg"), jpeg);
    await writeFile(join(folder, "02-detail.png"), png);

    try {
      await db.insert(products).values({
        id: productId,
        title: "Image intake integration product",
        slug,
        currency: "USD",
        priceMinor: 12500,
        status: "draft",
      });

      const preview = await previewLocalProductImageImport(intakeRoot);
      expect(preview.canCommit).toBe(true);
      expect(preview.matchedProducts).toBe(1);
      expect(preview.validImages).toBe(2);
      expect(preview.newImages).toBe(2);
      await expect(commitLocalProductImages("wrong-confirmation", intakeRoot)).rejects.toThrow("explicit");

      const imported = await commitLocalProductImages(PRODUCT_IMAGE_IMPORT_CONFIRMATION, intakeRoot);
      expect(imported.imagesCreated).toBe(2);
      expect(imported.imageRightsApproved).toBe(0);

      const rows = await db.select().from(productMedia)
        .where(eq(productMedia.productId, productId))
        .orderBy(asc(productMedia.position));
      expect(rows).toHaveLength(2);
      expect(rows[0].isPrimary).toBe(true);
      expect(rows[1].isPrimary).toBe(false);
      expect(rows.every((row) => row.rightsConfirmed === false && row.rightsEvidence === "")).toBe(true);
      expect(rows.map((row) => row.position)).toEqual([0, 1]);
      expect(rows[0].altText).toContain("primary product view");

      const storedJpeg = await readProductMedia(rows[0].storageKey);
      expect(storedJpeg?.mimeType).toBe("image/jpeg");
      expect(storedJpeg?.bytes).toEqual(jpeg);
      const storedPng = await readProductMedia(rows[1].storageKey);
      expect(storedPng?.mimeType).toBe("image/png");
      expect(storedPng?.bytes).toEqual(png);

      const replayPreview = await previewLocalProductImageImport(intakeRoot);
      expect(replayPreview.canCommit).toBe(true);
      expect(replayPreview.newImages).toBe(0);
      expect(replayPreview.duplicateImages).toBe(2);
      const replay = await commitLocalProductImages(PRODUCT_IMAGE_IMPORT_CONFIRMATION, intakeRoot);
      expect(replay.imagesCreated).toBe(0);
      expect(replay.existingImagesSkipped).toBe(2);

      const finalRows = await db.select().from(productMedia).where(eq(productMedia.productId, productId));
      expect(finalRows).toHaveLength(2);
    } finally {
      const rows = await db.select().from(productMedia).where(eq(productMedia.productId, productId));
      for (const row of rows) await removeProductMedia(row.storageKey).catch(() => undefined);
      await db.delete(products).where(eq(products.id, productId));
      if (previousMediaRoot === undefined) delete process.env.MEDIA_STORAGE_ROOT;
      else process.env.MEDIA_STORAGE_ROOT = previousMediaRoot;
      await rm(intakeRoot, { recursive: true, force: true });
      await rm(mediaRoot, { recursive: true, force: true });
    }
  }, 60_000);

  it("blocks product image folders without an exact MySQL slug match", async () => {
    const intakeRoot = await mkdtemp(join(tmpdir(), "dag-unmatched-intake-"));
    const folder = join(intakeRoot, "there-is-no-exact-match");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "01-primary.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0x00]));
    try {
      const preview = await previewLocalProductImageImport(intakeRoot);
      expect(preview.canCommit).toBe(false);
      expect(preview.errors.join(" ")).toContain("No MySQL product matches this exact slug");
    } finally {
      await rm(intakeRoot, { recursive: true, force: true });
    }
  });

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
