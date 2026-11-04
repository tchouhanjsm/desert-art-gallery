import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getMySqlDb } from "../db";
import {
  customerUsers,
  orders,
  productMedia,
  products,
  productVariants,
} from "../db/schema";

const ORDER_ATTENTION_STATUSES = ["draft", "pending_payment", "paid", "processing"] as const;
const LOW_STOCK_THRESHOLD = 3;

type CountRow = { count: number | string };

async function countValue(query: Promise<CountRow[]>): Promise<number> {
  const [row] = await query;
  return Number(row?.count ?? 0);
}

export async function getMySqlAdminDashboard() {
  const db = getMySqlDb();

  const [
    totalProducts,
    publishedProducts,
    draftProducts,
    archivedProducts,
    totalCustomers,
    totalProductImages,
    imagesAwaitingRights,
    ordersNeedingAttention,
    recentOrders,
    recentProducts,
    lowStockProducts,
  ] = await Promise.all([
    countValue(db.select({ count: sql<number>`COUNT(*)` }).from(products)),
    countValue(db.select({ count: sql<number>`COUNT(*)` }).from(products).where(eq(products.status, "published"))),
    countValue(db.select({ count: sql<number>`COUNT(*)` }).from(products).where(eq(products.status, "draft"))),
    countValue(db.select({ count: sql<number>`COUNT(*)` }).from(products).where(eq(products.status, "archived"))),
    countValue(db.select({ count: sql<number>`COUNT(*)` }).from(customerUsers)),
    countValue(db.select({ count: sql<number>`COUNT(*)` }).from(productMedia)),
    countValue(db.select({ count: sql<number>`COUNT(*)` }).from(productMedia).where(eq(productMedia.rightsConfirmed, false))),
    countValue(db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(inArray(orders.status, [...ORDER_ATTENTION_STATUSES]))),
    db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      email: orders.email,
      status: orders.status,
      currency: orders.currency,
      totalMinor: orders.totalMinor,
      createdAt: orders.createdAt,
    }).from(orders).orderBy(desc(orders.createdAt)).limit(6),
    db.select({
      id: products.id,
      title: products.title,
      slug: products.slug,
      status: products.status,
      priceMinor: products.priceMinor,
      currency: products.currency,
      updatedAt: products.updatedAt,
      stockQuantity: sql<number>`COALESCE(SUM(${productVariants.stockQuantity}), 0)`,
    }).from(products)
      .leftJoin(productVariants, and(
        eq(productVariants.productId, products.id),
        eq(productVariants.isActive, true),
      ))
      .groupBy(
        products.id,
        products.title,
        products.slug,
        products.status,
        products.priceMinor,
        products.currency,
        products.updatedAt,
      )
      .orderBy(desc(products.updatedAt))
      .limit(5),
    db.select({
      id: products.id,
      title: products.title,
      slug: products.slug,
      stockQuantity: sql<number>`COALESCE(SUM(${productVariants.stockQuantity}), 0)`,
    }).from(products)
      .leftJoin(productVariants, and(
        eq(productVariants.productId, products.id),
        eq(productVariants.isActive, true),
      ))
      .where(eq(products.status, "published"))
      .groupBy(products.id, products.title, products.slug)
      .having(sql`COALESCE(SUM(${productVariants.stockQuantity}), 0) <= ${LOW_STOCK_THRESHOLD}`)
      .orderBy(asc(sql`COALESCE(SUM(${productVariants.stockQuantity}), 0)`), asc(products.title))
      .limit(5),
  ]);

  return {
    totalProducts,
    publishedProducts,
    draftProducts,
    archivedProducts,
    totalCustomers,
    totalProductImages,
    imagesAwaitingRights,
    ordersNeedingAttention,
    recentOrders,
    recentProducts: recentProducts.map((product) => ({
      ...product,
      stockQuantity: Number(product.stockQuantity ?? 0),
    })),
    lowStockProducts: lowStockProducts.map((product) => ({
      ...product,
      stockQuantity: Number(product.stockQuantity ?? 0),
    })),
  };
}
