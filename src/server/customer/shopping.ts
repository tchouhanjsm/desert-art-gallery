import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { capPurchasableQuantity } from "@/lib/variants";
import { cartLineKey, combineCartLines, type CartLine, shouldMergeSavedCart } from "@/lib/cart";
import { normalizeWishlistSlugs } from "@/lib/wishlist";
import { getAvailableVariantQuantity, getPublishedProductBySlug } from "@/server/catalogue/repository";
import { getMySqlDb } from "@/server/db";
import { customerCartItems, customerWishlistItems, productVariants, products } from "@/server/db/schema";

export async function syncCustomerCart(customerUserId: string, guestLines: CartLine[], syncedUserId: unknown, accountSwitch = false): Promise<CartLine[]> {
  const db = getMySqlDb();
  const existingRows = await db.select({
    id: customerCartItems.id, variantId: customerCartItems.variantId,
    quantity: customerCartItems.quantity, slug: products.slug,
  }).from(customerCartItems)
    .innerJoin(products, eq(products.id, customerCartItems.productId))
    .where(eq(customerCartItems.customerUserId, customerUserId));
  const savedLines: CartLine[] = existingRows.map((row) => ({
    slug: row.slug, ...(row.variantId ? { variantId: row.variantId } : {}), quantity: row.quantity,
  }));
  const requestedLines = accountSwitch
    ? savedLines
    : combineCartLines(savedLines, guestLines, shouldMergeSavedCart(syncedUserId, customerUserId));
  const slugs = Array.from(new Set(requestedLines.map((line) => line.slug)));
  const productRows = slugs.length
    ? await db.select().from(products).where(and(eq(products.status, "published"), inArray(products.slug, slugs)))
    : [];
  const productBySlug = new Map(productRows.map((row) => [row.slug, row]));
  const productIds = productRows.map((row) => row.id);
  const variantRows = productIds.length
    ? await db.select().from(productVariants).where(and(inArray(productVariants.productId, productIds), eq(productVariants.isActive, true)))
    : [];
  const variantsByProduct = new Map<string, typeof variantRows>();
  for (const row of variantRows) {
    const rows = variantsByProduct.get(row.productId) ?? [];
    rows.push(row);
    variantsByProduct.set(row.productId, rows);
  }

  const desiredRows: Array<{ id: string; customerUserId: string; productId: string; variantId: string | null; lineKey: string; quantity: number; createdAt: Date; updatedAt: Date }> = [];
  for (const line of requestedLines) {
    const product = productBySlug.get(line.slug);
    if (!product) continue;
    const variants = variantsByProduct.get(product.id) ?? [];
    const selected = line.variantId
      ? variants.find((variant) => variant.id === line.variantId)
      : variants.length === 1 ? variants[0] : undefined;
    if (variants.length > 0 && !selected) continue;
    if (line.variantId && !selected) continue;
    if (!selected) continue;
    const available = await getAvailableVariantQuantity(selected.id);
    const maximum = capPurchasableQuantity(available, product.isOneOfAKind);
    const quantity = Math.min(line.quantity, maximum);
    if (quantity < 1) continue;
    const now = new Date();
    desiredRows.push({
      id: randomUUID(), customerUserId, productId: product.id, variantId: selected.id,
      lineKey: cartLineKey(product.slug, selected.id), quantity, createdAt: now, updatedAt: now,
    });
  }

  const validLineKeys = new Set(desiredRows.map((row) => row.lineKey));
  const staleIds = existingRows.filter((row) => !validLineKeys.has(cartLineKey(row.slug, row.variantId ?? undefined))).map((row) => row.id);
  await db.transaction(async (tx) => {
    for (const row of desiredRows) {
      await tx.insert(customerCartItems).values(row).onDuplicateKeyUpdate({
        set: { productId: row.productId, variantId: row.variantId, quantity: row.quantity, updatedAt: row.updatedAt },
      });
    }
    if (staleIds.length) {
      await tx.delete(customerCartItems).where(and(
        eq(customerCartItems.customerUserId, customerUserId), inArray(customerCartItems.id, staleIds),
      ));
    }
  });
  return desiredRows.map((row) => ({
    slug: productRows.find((item) => item.id === row.productId)?.slug ?? "",
    variantId: row.variantId ?? undefined,
    quantity: row.quantity,
  })).filter((line) => Boolean(line.slug));
}

export async function syncCustomerWishlist(customerUserId: string, guestSlugs: string[]): Promise<string[]> {
  const db = getMySqlDb();
  const existingRows = await db.select({
    id: customerWishlistItems.id, productId: customerWishlistItems.productId, slug: products.slug,
  }).from(customerWishlistItems)
    .innerJoin(products, eq(products.id, customerWishlistItems.productId))
    .where(eq(customerWishlistItems.customerUserId, customerUserId));
  const slugs = normalizeWishlistSlugs([...guestSlugs, ...existingRows.map((row) => row.slug)]);
  const productRows = slugs.length
    ? await db.select({ id: products.id, slug: products.slug }).from(products)
      .where(and(eq(products.status, "published"), inArray(products.slug, slugs)))
    : [];
  const validIds = new Set(productRows.map((row) => row.id));
  const staleIds = existingRows.filter((row) => !validIds.has(row.productId)).map((row) => row.id);
  await db.transaction(async (tx) => {
    for (const product of productRows) {
      await tx.insert(customerWishlistItems).values({
        id: randomUUID(), customerUserId, productId: product.id, createdAt: new Date(),
      }).onDuplicateKeyUpdate({ set: { productId: product.id } });
    }
    if (staleIds.length) {
      await tx.delete(customerWishlistItems).where(and(
        eq(customerWishlistItems.customerUserId, customerUserId), inArray(customerWishlistItems.id, staleIds),
      ));
    }
  });
  const ordered = new Set(slugs);
  return productRows.filter((row) => ordered.has(row.slug)).map((row) => row.slug);
}

export async function getMySqlCartPreview(lines: CartLine[]) {
  return Promise.all(lines.map(async (line) => {
    const product = await getPublishedProductBySlug(line.slug);
    if (!product) return {
      slug: line.slug, variantId: line.variantId ?? null, variantLabel: null,
      name: "This piece is no longer available", quantityRequested: line.quantity,
      availableQuantity: 0, available: false, priceMinor: null, currency: null, image: null, imageAlt: "",
    };
    const variants = product.variants ?? [];
    const selected = line.variantId
      ? variants.find((variant) => variant.id === line.variantId)
      : variants.length === 1 ? variants[0] : undefined;
    const invalidSelection = variants.length > 0 ? !selected : Boolean(line.variantId);
    const availableQuantity = selected
      ? capPurchasableQuantity(await getAvailableVariantQuantity(selected.id), Boolean(product.isOneOfAKind))
      : 0;
    const priceMinor = selected ? selected.priceMinor ?? product.priceMinor ?? null : null;
    return {
      slug: product.slug, variantId: selected?.id ?? line.variantId ?? null,
      variantLabel: selected?.label ?? (invalidSelection ? "Select an option on the product page" : null),
      name: product.name, quantityRequested: line.quantity, availableQuantity,
      available: !invalidSelection && Boolean(selected) && availableQuantity >= line.quantity && priceMinor !== null,
      priceMinor, currency: priceMinor === null ? null : product.currency ?? null,
      image: product.image || null, imageAlt: product.imageAlt || "",
    };
  }));
}
