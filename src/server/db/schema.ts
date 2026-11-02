import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  datetime,
  index,
  int,
  json,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const createdAt = () => datetime("created_at", { mode: "date", fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`);
const updatedAt = () => datetime("updated_at", { mode: "date", fsp: 3 })
  .notNull()
  .default(sql`CURRENT_TIMESTAMP(3)`)
  .$onUpdateFn(() => new Date());

export const siteContent = mysqlTable("site_content", {
  id: char("id", { length: 36 }).primaryKey(),
  contentKey: varchar("content_key", { length: 120 }).notNull(),
  title: varchar("title", { length: 255 }).notNull().default(""),
  body: json("body").$type<Record<string, unknown>>().notNull(),
  isPublished: boolean("is_published").notNull().default(false),
  updatedBy: char("updated_by", { length: 36 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("site_content_key_uq").on(table.contentKey),
  index("site_content_published_idx").on(table.isPublished, table.contentKey),
]);

export const collections = mysqlTable("collections", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  description: text("description").notNull(),
  heroImagePath: varchar("hero_image_path", { length: 512 }),
  heroImageAlt: varchar("hero_image_alt", { length: 300 }).notNull().default(""),
  heroImageRightsConfirmed: boolean("hero_image_rights_confirmed").notNull().default(false),
  heroImageRightsEvidence: varchar("hero_image_rights_evidence", { length: 1000 }).notNull().default(""),
  sortOrder: int("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("collections_slug_uq").on(table.slug),
  index("collections_public_order_idx").on(table.isPublished, table.sortOrder, table.name),
]);

export const collectionProductLinks = mysqlTable("collection_product_links", {
  id: char("id", { length: 36 }).primaryKey(),
  collectionId: char("collection_id", { length: 36 }).notNull().references(() => collections.id, { onDelete: "cascade" }),
  productSlug: varchar("product_slug", { length: 180 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("collection_product_links_pair_uq").on(table.collectionId, table.productSlug),
  index("collection_product_links_product_idx").on(table.productSlug),
]);

export const artisanProfiles = mysqlTable("artisan_profiles", {
  id: char("id", { length: 36 }).primaryKey(),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  roleTitle: varchar("role_title", { length: 120 }).notNull().default(""),
  shortBio: varchar("short_bio", { length: 360 }).notNull().default(""),
  biography: text("biography").notNull(),
  craftSpecialties: json("craft_specialties").$type<string[]>().notNull(),
  yearsExperience: smallint("years_experience"),
  portraitPath: varchar("portrait_path", { length: 512 }),
  portraitAltText: varchar("portrait_alt_text", { length: 300 }).notNull().default(""),
  portraitRightsConfirmed: boolean("portrait_rights_confirmed").notNull().default(false),
  portraitRightsEvidence: varchar("portrait_rights_evidence", { length: 1000 }).notNull().default(""),
  sortOrder: int("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("artisan_profiles_public_order_idx").on(table.isPublished, table.sortOrder, table.fullName),
]);

export const journalPosts = mysqlTable("journal_posts", {
  id: char("id", { length: 36 }).primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  excerpt: varchar("excerpt", { length: 500 }).notNull(),
  contentMarkdown: text("content_markdown").notNull(),
  category: varchar("category", { length: 100 }).notNull().default("Stories"),
  coverImagePath: varchar("cover_image_path", { length: 512 }),
  coverImageAlt: varchar("cover_image_alt", { length: 300 }).notNull().default(""),
  coverImageRightsConfirmed: boolean("cover_image_rights_confirmed").notNull().default(false),
  coverImageRightsEvidence: varchar("cover_image_rights_evidence", { length: 1000 }).notNull().default(""),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  authorId: char("author_id", { length: 36 }),
  publishedAt: datetime("published_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("journal_posts_slug_uq").on(table.slug),
  index("journal_posts_publication_idx").on(table.status, table.publishedAt),
  index("journal_posts_updated_idx").on(table.updatedAt),
]);

export const productCategories = mysqlTable("product_categories", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull(),
  description: text("description").notNull().default(""),
  sortOrder: int("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("product_categories_slug_uq").on(table.slug),
  index("product_categories_active_order_idx").on(table.isActive, table.sortOrder, table.name),
]);

export const products = mysqlTable("products", {
  id: char("id", { length: 36 }).primaryKey(),
  legacyId: char("legacy_id", { length: 36 }),
  title: varchar("title", { length: 240 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull(),
  description: text("description").notNull().default(""),
  productType: varchar("product_type", { length: 100 }).notNull().default(""),
  currency: char("currency", { length: 3 }).notNull(),
  priceMinor: bigint("price_minor", { mode: "number", unsigned: true }).notNull(),
  compareAtPriceMinor: bigint("compare_at_price_minor", { mode: "number", unsigned: true }),
  status: varchar("status", { length: 16 }).$type<"draft" | "published" | "archived">().notNull().default("draft"),
  isOneOfAKind: boolean("is_one_of_a_kind").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  seoTitle: varchar("seo_title", { length: 255 }).notNull().default(""),
  seoDescription: varchar("seo_description", { length: 500 }).notNull().default(""),
  publishedAt: datetime("published_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("products_slug_uq").on(table.slug),
  uniqueIndex("products_legacy_id_uq").on(table.legacyId),
  index("products_status_created_idx").on(table.status, table.createdAt),
  index("products_featured_status_idx").on(table.featured, table.status),
]);

export const productCategoryLinks = mysqlTable("product_category_links", {
  productId: char("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  categoryId: char("category_id", { length: 36 }).notNull().references(() => productCategories.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.productId, table.categoryId] }),
  index("product_category_links_category_idx").on(table.categoryId, table.productId),
]);

export const productVariants = mysqlTable("product_variants", {
  id: char("id", { length: 36 }).primaryKey(),
  productId: char("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  sku: varchar("sku", { length: 100 }).notNull(),
  label: varchar("label", { length: 180 }).notNull(),
  attributes: json("attributes").$type<Record<string, string>>().notNull(),
  priceMinor: bigint("price_minor", { mode: "number", unsigned: true }),
  currency: char("currency", { length: 3 }).notNull(),
  stockQuantity: int("stock_quantity", { unsigned: true }).notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("product_variants_sku_uq").on(table.sku),
  index("product_variants_product_order_idx").on(table.productId, table.isActive, table.sortOrder),
]);

export const productMedia = mysqlTable("product_media", {
  id: char("id", { length: 36 }).primaryKey(),
  productId: char("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  storageKey: varchar("storage_key", { length: 512 }).notNull(),
  altText: varchar("alt_text", { length: 300 }).notNull(),
  rightsConfirmed: boolean("rights_confirmed").notNull().default(false),
  rightsEvidence: varchar("rights_evidence", { length: 1000 }).notNull().default(""),
  mimeType: varchar("mime_type", { length: 40 }).notNull(),
  byteSize: bigint("byte_size", { mode: "number", unsigned: true }).notNull(),
  width: int("width", { unsigned: true }),
  height: int("height", { unsigned: true }),
  position: int("position").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("product_media_storage_key_uq").on(table.storageKey),
  index("product_media_product_order_idx").on(table.productId, table.position, table.id),
]);

export const inventoryMovements = mysqlTable("inventory_movements", {
  id: char("id", { length: 36 }).primaryKey(),
  variantId: char("variant_id", { length: 36 }).notNull().references(() => productVariants.id, { onDelete: "restrict" }),
  quantityDelta: int("quantity_delta").notNull(),
  reason: varchar("reason", { length: 160 }).notNull(),
  referenceKey: varchar("reference_key", { length: 180 }).notNull(),
  actorId: char("actor_id", { length: 36 }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("inventory_movements_reference_uq").on(table.referenceKey),
  index("inventory_movements_variant_created_idx").on(table.variantId, table.createdAt),
]);

export const inventoryReservations = mysqlTable("inventory_reservations", {
  id: char("id", { length: 36 }).primaryKey(),
  customerReference: varchar("customer_reference", { length: 180 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
  status: varchar("status", { length: 16 }).$type<"reserved" | "released" | "expired">().notNull().default("reserved"),
  expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("inventory_reservations_idempotency_uq").on(table.idempotencyKey),
  index("inventory_reservations_expiry_idx").on(table.status, table.expiresAt),
]);

export const inventoryReservationItems = mysqlTable("inventory_reservation_items", {
  id: char("id", { length: 36 }).primaryKey(),
  reservationId: char("reservation_id", { length: 36 }).notNull().references(() => inventoryReservations.id, { onDelete: "cascade" }),
  variantId: char("variant_id", { length: 36 }).notNull().references(() => productVariants.id, { onDelete: "restrict" }),
  quantity: int("quantity", { unsigned: true }).notNull(),
}, (table) => [
  uniqueIndex("inventory_reservation_items_pair_uq").on(table.reservationId, table.variantId),
  index("inventory_reservation_items_variant_idx").on(table.variantId),
]);

