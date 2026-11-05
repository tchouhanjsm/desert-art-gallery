import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
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
  check("collections_hero_rights_evidence_check", sql`NOT ${table.heroImageRightsConfirmed} OR (CHAR_LENGTH(TRIM(${table.heroImageRightsEvidence})) > 0 AND CHAR_LENGTH(TRIM(${table.heroImageAlt})) > 0)`),
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
  check("artisan_portrait_rights_evidence_check", sql`NOT ${table.portraitRightsConfirmed} OR (CHAR_LENGTH(TRIM(${table.portraitRightsEvidence})) > 0 AND CHAR_LENGTH(TRIM(${table.portraitAltText})) > 0)`),
  check("artisan_experience_range_check", sql`${table.yearsExperience} IS NULL OR ${table.yearsExperience} BETWEEN 0 AND 100`),
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
  check("journal_status_check", sql`${table.status} IN ('draft','published','archived')`),
  check("journal_cover_rights_evidence_check", sql`NOT ${table.coverImageRightsConfirmed} OR (CHAR_LENGTH(TRIM(${table.coverImageRightsEvidence})) > 0 AND CHAR_LENGTH(TRIM(${table.coverImageAlt})) > 0)`),
]);

export const productCategories = mysqlTable("product_categories", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull(),
  description: varchar("description", { length: 2000 }).notNull().default(""),
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
  shortDescription: varchar("short_description", { length: 240 }).notNull().default(""),
  description: text("description"),
  productType: varchar("product_type", { length: 100 }).notNull().default(""),
  materials: json("materials").$type<string[] | null>(),
  tags: json("tags").$type<string[] | null>(),
  sourceMetadata: json("source_metadata").$type<Record<string, unknown> | null>(),
  sizes: json("sizes").$type<string[] | null>(),
  measurements: json("measurements").$type<Record<string, unknown> | null>(),
  conditionNotes: text("condition_notes"),
  provenance: text("provenance"),
  craftStory: text("craft_story"),
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
  check("products_currency_check", sql`${table.currency} REGEXP '^[A-Z]{3}$'`),
  check("products_status_check", sql`${table.status} IN ('draft','published','archived')`),
  check("products_price_compare_check", sql`${table.compareAtPriceMinor} IS NULL OR ${table.compareAtPriceMinor} >= ${table.priceMinor}`),
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
  sku: varchar("sku", { length: 100 }),
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
  check("product_variants_currency_check", sql` ${table.currency} REGEXP '^[A-Z]{3}$'`),
  check("product_variants_stock_check", sql`${table.stockQuantity} >= 0`),
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
  check("product_media_rights_check", sql`NOT ${table.rightsConfirmed} OR (CHAR_LENGTH(TRIM(${table.altText})) > 0 AND CHAR_LENGTH(TRIM(${table.rightsEvidence})) > 0)`),
  check("product_media_mime_check", sql`${table.mimeType} IN ('image/jpeg','image/png','image/webp','image/avif')`),
  check("product_media_size_check", sql`${table.byteSize} > 0 AND ${table.byteSize} <= 12582912`),
  check("product_media_dimensions_check", sql`(${table.width} IS NULL AND ${table.height} IS NULL) OR (${table.width} > 0 AND ${table.height} > 0)`),
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
  check("inventory_movement_nonzero_check", sql`${table.quantityDelta} <> 0`),
]);

export const inventoryReservations = mysqlTable("inventory_reservations", {
  id: char("id", { length: 36 }).primaryKey(),
  customerReference: varchar("customer_reference", { length: 180 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
  status: varchar("status", { length: 16 }).$type<"reserved" | "released" | "expired" | "consumed">().notNull().default("reserved"),
  expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("inventory_reservations_idempotency_uq").on(table.idempotencyKey),
  index("inventory_reservations_expiry_idx").on(table.status, table.expiresAt),
  check("inventory_reservations_status_check", sql`${table.status} IN ('reserved','released','expired','consumed')`),
]);

export const inventoryReservationItems = mysqlTable("inventory_reservation_items", {
  id: char("id", { length: 36 }).primaryKey(),
  reservationId: char("reservation_id", { length: 36 }).notNull().references(() => inventoryReservations.id, { onDelete: "cascade" }),
  variantId: char("variant_id", { length: 36 }).notNull().references(() => productVariants.id, { onDelete: "restrict" }),
  quantity: int("quantity", { unsigned: true }).notNull(),
  productIdSnapshot: char("product_id_snapshot", { length: 36 }),
  productTitleSnapshot: varchar("product_title_snapshot", { length: 240 }),
  productSkuSnapshot: varchar("product_sku_snapshot", { length: 100 }),
  variantLabelSnapshot: varchar("variant_label_snapshot", { length: 180 }),
  selectedOptionsSnapshot: json("selected_options_snapshot").$type<Record<string, string> | null>(),
  unitPriceMinorSnapshot: bigint("unit_price_minor_snapshot", { mode: "number", unsigned: true }),
  currencySnapshot: char("currency_snapshot", { length: 3 }),
}, (table) => [
  uniqueIndex("inventory_reservation_items_pair_uq").on(table.reservationId, table.variantId),
  index("inventory_reservation_items_variant_idx").on(table.variantId),
  check("inventory_reservation_items_quantity_check", sql`${table.quantity} > 0`),
]);


export const adminUsers = mysqlTable("admin_users", {
  id: char("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 160 }).notNull().default(""),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 16 }).$type<"owner" | "admin">().notNull().default("owner"),
  isActive: boolean("is_active").notNull().default(true),
  failedLoginCount: int("failed_login_count").notNull().default(0),
  lockedUntil: datetime("locked_until", { mode: "date", fsp: 3 }),
  lastLoginAt: datetime("last_login_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("admin_users_email_uq").on(table.email),
  index("admin_users_active_role_idx").on(table.isActive, table.role),
  check("admin_users_role_check", sql`${table.role} IN ('owner','admin')`),
  check("admin_users_failed_login_count_check", sql`${table.failedLoginCount} BETWEEN 0 AND 100`),
]);

export const adminSessions = mysqlTable("admin_sessions", {
  id: char("id", { length: 36 }).primaryKey(),
  adminUserId: char("admin_user_id", { length: 36 }).notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  tokenHash: char("token_hash", { length: 64 }).notNull(),
  expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("admin_sessions_token_hash_uq").on(table.tokenHash),
  index("admin_sessions_user_expiry_idx").on(table.adminUserId, table.expiresAt),
]);


export const catalogueImportBatches = mysqlTable("catalogue_import_batches", {
  id: char("id", { length: 36 }).primaryKey(),
  sourceSha256: char("source_sha256", { length: 64 }).notNull(),
  sourceName: varchar("source_name", { length: 255 }).notNull(),
  rowCount: int("row_count").notNull(),
  productsCreated: int("products_created").notNull(),
  stockUnitsAdded: bigint("stock_units_added", { mode: "number", unsigned: true }).notNull(),
  report: json("report").$type<Record<string, unknown>>().notNull(),
  createdBy: char("created_by", { length: 36 }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("catalogue_import_batches_source_sha_uq").on(table.sourceSha256),
  index("catalogue_import_batches_created_idx").on(table.createdAt),
  check("catalogue_import_batches_row_count_check", sql`${table.rowCount} BETWEEN 1 AND 1000`),
  check("catalogue_import_batches_products_check", sql`${table.productsCreated} BETWEEN 1 AND 1000`),
]);


export const customerUsers = mysqlTable("customer_users", {
  id: char("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull().default(""),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  failedLoginCount: int("failed_login_count").notNull().default(0),
  lockedUntil: datetime("locked_until", { mode: "date", fsp: 3 }),
  lastLoginAt: datetime("last_login_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("customer_users_email_uq").on(table.email),
  index("customer_users_active_idx").on(table.isActive),
  check("customer_users_failed_login_count_check", sql`${table.failedLoginCount} BETWEEN 0 AND 100`),
]);

export const customerSessions = mysqlTable("customer_sessions", {
  id: char("id", { length: 36 }).primaryKey(),
  customerUserId: char("customer_user_id", { length: 36 }).notNull().references(() => customerUsers.id, { onDelete: "cascade" }),
  tokenHash: char("token_hash", { length: 64 }).notNull(),
  expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("customer_sessions_token_hash_uq").on(table.tokenHash),
  index("customer_sessions_user_expiry_idx").on(table.customerUserId, table.expiresAt),
]);

export const customerAddresses = mysqlTable("customer_addresses", {
  id: char("id", { length: 36 }).primaryKey(),
  customerUserId: char("customer_user_id", { length: 36 }).notNull().references(() => customerUsers.id, { onDelete: "cascade" }),
  recipientName: varchar("recipient_name", { length: 160 }).notNull(),
  addressLine1: varchar("address_line_1", { length: 240 }).notNull(),
  addressLine2: varchar("address_line_2", { length: 240 }).notNull().default(""),
  city: varchar("city", { length: 120 }).notNull(),
  region: varchar("region", { length: 120 }).notNull().default(""),
  postalCode: varchar("postal_code", { length: 24 }).notNull(),
  countryCode: char("country_code", { length: 2 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull().default(""),
  isDefaultShipping: boolean("is_default_shipping").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("customer_addresses_customer_default_idx").on(table.customerUserId, table.isDefaultShipping, table.createdAt),
  check("customer_addresses_country_check", sql`${table.countryCode} REGEXP '^[A-Z]{2}$'`),
  check("customer_addresses_required_check", sql`CHAR_LENGTH(TRIM(${table.recipientName})) > 0 AND CHAR_LENGTH(TRIM(${table.addressLine1})) > 0 AND CHAR_LENGTH(TRIM(${table.city})) > 0 AND CHAR_LENGTH(TRIM(${table.postalCode})) > 0`),
]);

export const customerCartItems = mysqlTable("customer_cart_items", {
  id: char("id", { length: 36 }).primaryKey(),
  customerUserId: char("customer_user_id", { length: 36 }).notNull().references(() => customerUsers.id, { onDelete: "cascade" }),
  productId: char("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  variantId: char("variant_id", { length: 36 }).references(() => productVariants.id, { onDelete: "cascade" }),
  lineKey: varchar("line_key", { length: 240 }).notNull(),
  quantity: int("quantity", { unsigned: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("customer_cart_items_line_uq").on(table.customerUserId, table.lineKey),
  index("customer_cart_items_product_idx").on(table.productId),
  index("customer_cart_items_variant_idx").on(table.variantId),
  check("customer_cart_items_quantity_check", sql`${table.quantity} BETWEEN 1 AND 99`),
]);

export const customerWishlistItems = mysqlTable("customer_wishlist_items", {
  id: char("id", { length: 36 }).primaryKey(),
  customerUserId: char("customer_user_id", { length: 36 }).notNull().references(() => customerUsers.id, { onDelete: "cascade" }),
  productId: char("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("customer_wishlist_items_product_uq").on(table.customerUserId, table.productId),
  index("customer_wishlist_items_created_idx").on(table.customerUserId, table.createdAt),
]);


export type MySqlOrderStatus = "draft" | "pending_payment" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "expired" | "refunded";

export const shippingZones = mysqlTable("shipping_zones", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  countryCodes: json("country_codes").$type<string[]>().notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("shipping_zones_name_uq").on(table.name),
  index("shipping_zones_active_idx").on(table.isActive),
  check("shipping_zones_countries_check", sql.raw("JSON_TYPE(country_codes) = 'ARRAY' AND JSON_LENGTH(country_codes) BETWEEN 1 AND 50")),
]);

export const shippingRates = mysqlTable("shipping_rates", {
  id: char("id", { length: 36 }).primaryKey(),
  zoneId: char("zone_id", { length: 36 }).notNull().references(() => shippingZones.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 120 }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "number", unsigned: true }).notNull(),
  minDeliveryDays: smallint("min_delivery_days", { unsigned: true }),
  maxDeliveryDays: smallint("max_delivery_days", { unsigned: true }),
  dutiesDisclosure: varchar("duties_disclosure", { length: 2000 }).notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("shipping_rates_zone_active_idx").on(table.zoneId, table.isActive, table.currency),
  check("shipping_rates_currency_check", sql.raw("currency REGEXP '^[A-Z]{3}$'")),
  check("shipping_rates_duties_check", sql.raw("CHAR_LENGTH(TRIM(duties_disclosure)) BETWEEN 1 AND 2000")),
  check("shipping_rates_delivery_days_check", sql.raw("(min_delivery_days IS NULL AND max_delivery_days IS NULL) OR (min_delivery_days IS NOT NULL AND max_delivery_days IS NOT NULL AND min_delivery_days <= max_delivery_days AND max_delivery_days <= 365)")),
]);

export const checkoutTaxRules = mysqlTable("checkout_tax_rules", {
  id: char("id", { length: 36 }).primaryKey(),
  countryCode: char("country_code", { length: 2 }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  taxName: varchar("tax_name", { length: 120 }).notNull(),
  rateBasisPoints: int("rate_basis_points", { unsigned: true }).notNull(),
  taxableShipping: boolean("taxable_shipping").notNull().default(false),
  disclosure: varchar("disclosure", { length: 2000 }).notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("checkout_tax_rules_destination_name_uq").on(table.countryCode, table.currency, table.taxName),
  index("checkout_tax_rules_destination_idx").on(table.countryCode, table.currency, table.isActive),
  check("checkout_tax_rules_country_check", sql.raw("country_code REGEXP '^[A-Z]{2}$'")),
  check("checkout_tax_rules_currency_check", sql.raw("currency REGEXP '^[A-Z]{3}$'")),
  check("checkout_tax_rules_rate_check", sql.raw("rate_basis_points BETWEEN 0 AND 10000")),
  check("checkout_tax_rules_disclosure_check", sql.raw("CHAR_LENGTH(TRIM(disclosure)) BETWEEN 1 AND 2000")),
  check("checkout_tax_rules_name_check", sql.raw("CHAR_LENGTH(TRIM(tax_name)) BETWEEN 1 AND 120")),
]);

export const orders = mysqlTable("orders", {
  id: char("id", { length: 36 }).primaryKey(),
  orderNumber: varchar("order_number", { length: 32 }).notNull(),
  customerUserId: char("customer_user_id", { length: 36 }).notNull().references(() => customerUsers.id, { onDelete: "restrict" }),
  email: varchar("email", { length: 255 }).notNull(),
  reservationId: char("reservation_id", { length: 36 }).notNull().references(() => inventoryReservations.id, { onDelete: "restrict" }),
  checkoutIdempotencyKey: char("checkout_idempotency_key", { length: 36 }).notNull(),
  checkoutRequestHash: char("checkout_request_hash", { length: 64 }).notNull(),
  status: varchar("status", { length: 24 }).$type<MySqlOrderStatus>().notNull().default("draft"),
  currency: char("currency", { length: 3 }).notNull(),
  subtotalMinor: bigint("subtotal_minor", { mode: "number", unsigned: true }).notNull(),
  shippingMinor: bigint("shipping_minor", { mode: "number", unsigned: true }).notNull(),
  taxMinor: bigint("tax_minor", { mode: "number", unsigned: true }).notNull(),
  discountMinor: bigint("discount_minor", { mode: "number", unsigned: true }).notNull().default(0),
  totalMinor: bigint("total_minor", { mode: "number", unsigned: true }).notNull(),
  shippingAddress: json("shipping_address").$type<Record<string, string>>().notNull(),
  customerNote: varchar("customer_note", { length: 1000 }),
  expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
  shippingRateId: char("shipping_rate_id", { length: 36 }).references(() => shippingRates.id, { onDelete: "set null" }),
  shippingZoneName: varchar("shipping_zone_name", { length: 120 }).notNull(),
  shippingRateName: varchar("shipping_rate_name", { length: 120 }).notNull(),
  shippingDeliveryMinDays: smallint("shipping_delivery_min_days", { unsigned: true }),
  shippingDeliveryMaxDays: smallint("shipping_delivery_max_days", { unsigned: true }),
  dutiesDisclosure: varchar("duties_disclosure", { length: 2000 }).notNull(),
  taxBreakdown: json("tax_breakdown").$type<Array<{ name: string; rate_basis_points: number; amount_minor: number }>>().notNull(),
  taxDisclosure: varchar("tax_disclosure", { length: 10000 }).notNull(),
  trackingCarrier: varchar("tracking_carrier", { length: 100 }),
  trackingNumber: varchar("tracking_number", { length: 160 }),
  trackingUrl: varchar("tracking_url", { length: 1000 }),
  shippedAt: datetime("shipped_at", { mode: "date", fsp: 3 }),
  deliveredAt: datetime("delivered_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("orders_number_uq").on(table.orderNumber),
  uniqueIndex("orders_reservation_uq").on(table.reservationId),
  uniqueIndex("orders_customer_checkout_key_uq").on(table.customerUserId, table.checkoutIdempotencyKey),
  index("orders_customer_created_idx").on(table.customerUserId, table.createdAt),
  index("orders_status_created_idx").on(table.status, table.createdAt),
  index("orders_expiry_idx").on(table.status, table.expiresAt),
  check("orders_currency_check", sql.raw("currency REGEXP '^[A-Z]{3}$'")),
  check("orders_status_check", sql.raw("status IN ('draft','pending_payment','paid','processing','shipped','delivered','cancelled','expired','refunded')")),
  check("orders_checkout_hash_check", sql.raw("checkout_request_hash REGEXP '^[a-f0-9]{64}$'")),
  check("orders_amounts_check", sql.raw("total_minor = subtotal_minor + shipping_minor + tax_minor - discount_minor")),
  check("orders_delivery_days_check", sql.raw("(shipping_delivery_min_days IS NULL AND shipping_delivery_max_days IS NULL) OR (shipping_delivery_min_days IS NOT NULL AND shipping_delivery_max_days IS NOT NULL AND shipping_delivery_min_days <= shipping_delivery_max_days AND shipping_delivery_max_days <= 365)")),
]);

export type MySqlPaymentAttemptStatus = "creating" | "creation_unknown" | "created" | "authorized" | "captured" | "failed" | "captured_after_expiry";
export type MySqlPaymentRefundStatus = "requested" | "pending" | "processed" | "failed" | "unknown";

export const paymentAttempts = mysqlTable("payment_attempts", {
  id: char("id", { length: 36 }).primaryKey(),
  orderId: char("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "restrict" }),
  provider: varchar("provider", { length: 24 }).notNull().default("razorpay"),
  idempotencyKey: char("idempotency_key", { length: 36 }).notNull(),
  requestHash: char("request_hash", { length: 64 }).notNull(),
  providerReceipt: varchar("provider_receipt", { length: 40 }).notNull(),
  providerOrderId: varchar("provider_order_id", { length: 64 }),
  providerPaymentId: varchar("provider_payment_id", { length: 64 }),
  status: varchar("status", { length: 32 }).$type<MySqlPaymentAttemptStatus>().notNull().default("creating"),
  amountMinor: bigint("amount_minor", { mode: "number", unsigned: true }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  failureCode: varchar("failure_code", { length: 80 }),
  authorizedAt: datetime("authorized_at", { mode: "date", fsp: 3 }),
  capturedAt: datetime("captured_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("payment_attempts_order_key_uq").on(table.orderId, table.idempotencyKey),
  uniqueIndex("payment_attempts_provider_receipt_uq").on(table.provider, table.providerReceipt),
  uniqueIndex("payment_attempts_provider_order_uq").on(table.provider, table.providerOrderId),
  uniqueIndex("payment_attempts_provider_payment_uq").on(table.provider, table.providerPaymentId),
  index("payment_attempts_order_status_idx").on(table.orderId, table.status, table.createdAt),
  check("payment_attempts_provider_check", sql.raw("provider = 'razorpay'")),
  check("payment_attempts_status_check", sql.raw("status IN ('creating','creation_unknown','created','authorized','captured','failed','captured_after_expiry')")),
  check("payment_attempts_amount_check", sql.raw("amount_minor > 0")),
  check("payment_attempts_currency_check", sql.raw("currency REGEXP '^[A-Z]{3}
  id: char("id", { length: 36 }).primaryKey(),
  orderId: char("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  productIdSnapshot: char("product_id_snapshot", { length: 36 }).notNull(),
  variantIdSnapshot: char("variant_id_snapshot", { length: 36 }).notNull(),
  productTitle: varchar("product_title", { length: 240 }).notNull(),
  productSku: varchar("product_sku", { length: 100 }),
  variantLabel: varchar("variant_label", { length: 180 }).notNull(),
  quantity: int("quantity", { unsigned: true }).notNull(),
  unitPriceMinor: bigint("unit_price_minor", { mode: "number", unsigned: true }).notNull(),
  lineTotalMinor: bigint("line_total_minor", { mode: "number", unsigned: true }).notNull(),
  selectedOptions: json("selected_options").$type<Record<string, string>>().notNull(),
  createdAt: createdAt(),
}, (table) => [
  index("order_items_order_idx").on(table.orderId, table.createdAt),
  check("order_items_quantity_check", sql.raw("quantity BETWEEN 1 AND 100")),
  check("order_items_total_check", sql.raw("line_total_minor = quantity * unit_price_minor")),
]);

export const orderEvents = mysqlTable("order_events", {
  id: char("id", { length: 36 }).primaryKey(),
  orderId: char("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  actorType: varchar("actor_type", { length: 16 }).$type<"customer" | "admin" | "system">().notNull(),
  actorId: char("actor_id", { length: 36 }),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  fromStatus: varchar("from_status", { length: 24 }).$type<MySqlOrderStatus>(),
  toStatus: varchar("to_status", { length: 24 }).$type<MySqlOrderStatus>(),
  note: varchar("note", { length: 1000 }),
  createdAt: createdAt(),
}, (table) => [
  index("order_events_order_created_idx").on(table.orderId, table.createdAt),
  check("order_events_actor_type_check", sql.raw("actor_type IN ('customer','admin','system')")),
]);
")),
  check("payment_attempts_hash_check", sql.raw("request_hash REGEXP '^[a-f0-9]{64}
  id: char("id", { length: 36 }).primaryKey(),
  orderId: char("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  productIdSnapshot: char("product_id_snapshot", { length: 36 }).notNull(),
  variantIdSnapshot: char("variant_id_snapshot", { length: 36 }).notNull(),
  productTitle: varchar("product_title", { length: 240 }).notNull(),
  productSku: varchar("product_sku", { length: 100 }),
  variantLabel: varchar("variant_label", { length: 180 }).notNull(),
  quantity: int("quantity", { unsigned: true }).notNull(),
  unitPriceMinor: bigint("unit_price_minor", { mode: "number", unsigned: true }).notNull(),
  lineTotalMinor: bigint("line_total_minor", { mode: "number", unsigned: true }).notNull(),
  selectedOptions: json("selected_options").$type<Record<string, string>>().notNull(),
  createdAt: createdAt(),
}, (table) => [
  index("order_items_order_idx").on(table.orderId, table.createdAt),
  check("order_items_quantity_check", sql.raw("quantity BETWEEN 1 AND 100")),
  check("order_items_total_check", sql.raw("line_total_minor = quantity * unit_price_minor")),
]);

export const orderEvents = mysqlTable("order_events", {
  id: char("id", { length: 36 }).primaryKey(),
  orderId: char("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  actorType: varchar("actor_type", { length: 16 }).$type<"customer" | "admin" | "system">().notNull(),
  actorId: char("actor_id", { length: 36 }),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  fromStatus: varchar("from_status", { length: 24 }).$type<MySqlOrderStatus>(),
  toStatus: varchar("to_status", { length: 24 }).$type<MySqlOrderStatus>(),
  note: varchar("note", { length: 1000 }),
  createdAt: createdAt(),
}, (table) => [
  index("order_events_order_created_idx").on(table.orderId, table.createdAt),
  check("order_events_actor_type_check", sql.raw("actor_type IN ('customer','admin','system')")),
]);
")),
]);

export const paymentWebhookEvents = mysqlTable("payment_webhook_events", {
  id: char("id", { length: 36 }).primaryKey(),
  provider: varchar("provider", { length: 24 }).notNull().default("razorpay"),
  providerEventId: varchar("provider_event_id", { length: 128 }).notNull(),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  payloadSha256: char("payload_sha256", { length: 64 }).notNull(),
  paymentAttemptId: char("payment_attempt_id", { length: 36 }).references(() => paymentAttempts.id, { onDelete: "set null" }),
  processingResult: varchar("processing_result", { length: 24 }).$type<"processed" | "ignored">().notNull().default("processed"),
  receivedAt: createdAt(),
  processedAt: datetime("processed_at", { mode: "date", fsp: 3 }).notNull().default(sql.raw("CURRENT_TIMESTAMP(3)")),
}, (table) => [
  uniqueIndex("payment_webhook_provider_event_uq").on(table.provider, table.providerEventId),
  index("payment_webhook_attempt_received_idx").on(table.paymentAttemptId, table.receivedAt),
  check("payment_webhook_provider_check", sql.raw("provider = 'razorpay'")),
  check("payment_webhook_result_check", sql.raw("processing_result IN ('processed','ignored')")),
  check("payment_webhook_hash_check", sql.raw("payload_sha256 REGEXP '^[a-f0-9]{64}
  id: char("id", { length: 36 }).primaryKey(),
  orderId: char("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  productIdSnapshot: char("product_id_snapshot", { length: 36 }).notNull(),
  variantIdSnapshot: char("variant_id_snapshot", { length: 36 }).notNull(),
  productTitle: varchar("product_title", { length: 240 }).notNull(),
  productSku: varchar("product_sku", { length: 100 }),
  variantLabel: varchar("variant_label", { length: 180 }).notNull(),
  quantity: int("quantity", { unsigned: true }).notNull(),
  unitPriceMinor: bigint("unit_price_minor", { mode: "number", unsigned: true }).notNull(),
  lineTotalMinor: bigint("line_total_minor", { mode: "number", unsigned: true }).notNull(),
  selectedOptions: json("selected_options").$type<Record<string, string>>().notNull(),
  createdAt: createdAt(),
}, (table) => [
  index("order_items_order_idx").on(table.orderId, table.createdAt),
  check("order_items_quantity_check", sql.raw("quantity BETWEEN 1 AND 100")),
  check("order_items_total_check", sql.raw("line_total_minor = quantity * unit_price_minor")),
]);

export const orderEvents = mysqlTable("order_events", {
  id: char("id", { length: 36 }).primaryKey(),
  orderId: char("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  actorType: varchar("actor_type", { length: 16 }).$type<"customer" | "admin" | "system">().notNull(),
  actorId: char("actor_id", { length: 36 }),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  fromStatus: varchar("from_status", { length: 24 }).$type<MySqlOrderStatus>(),
  toStatus: varchar("to_status", { length: 24 }).$type<MySqlOrderStatus>(),
  note: varchar("note", { length: 1000 }),
  createdAt: createdAt(),
}, (table) => [
  index("order_events_order_created_idx").on(table.orderId, table.createdAt),
  check("order_events_actor_type_check", sql.raw("actor_type IN ('customer','admin','system')")),
]);
")),
]);

export const paymentRefunds = mysqlTable("payment_refunds", {
  id: char("id", { length: 36 }).primaryKey(),
  paymentAttemptId: char("payment_attempt_id", { length: 36 }).notNull().references(() => paymentAttempts.id, { onDelete: "restrict" }),
  orderId: char("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "restrict" }),
  provider: varchar("provider", { length: 24 }).notNull().default("razorpay"),
  idempotencyKey: varchar("idempotency_key", { length: 40 }).notNull(),
  requestHash: char("request_hash", { length: 64 }).notNull(),
  providerRefundId: varchar("provider_refund_id", { length: 64 }),
  amountMinor: bigint("amount_minor", { mode: "number", unsigned: true }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 24 }).$type<MySqlPaymentRefundStatus>().notNull().default("requested"),
  reason: varchar("reason", { length: 500 }).notNull(),
  requestedBy: char("requested_by", { length: 36 }).notNull(),
  failureCode: varchar("failure_code", { length: 80 }),
  processedAt: datetime("processed_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("payment_refunds_provider_key_uq").on(table.provider, table.idempotencyKey),
  uniqueIndex("payment_refunds_provider_id_uq").on(table.provider, table.providerRefundId),
  index("payment_refunds_order_status_idx").on(table.orderId, table.status, table.createdAt),
  index("payment_refunds_attempt_status_idx").on(table.paymentAttemptId, table.status),
  check("payment_refunds_provider_check", sql.raw("provider = 'razorpay'")),
  check("payment_refunds_status_check", sql.raw("status IN ('requested','pending','processed','failed','unknown')")),
  check("payment_refunds_amount_check", sql.raw("amount_minor > 0")),
  check("payment_refunds_currency_check", sql.raw("currency REGEXP '^[A-Z]{3}
  id: char("id", { length: 36 }).primaryKey(),
  orderId: char("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  productIdSnapshot: char("product_id_snapshot", { length: 36 }).notNull(),
  variantIdSnapshot: char("variant_id_snapshot", { length: 36 }).notNull(),
  productTitle: varchar("product_title", { length: 240 }).notNull(),
  productSku: varchar("product_sku", { length: 100 }),
  variantLabel: varchar("variant_label", { length: 180 }).notNull(),
  quantity: int("quantity", { unsigned: true }).notNull(),
  unitPriceMinor: bigint("unit_price_minor", { mode: "number", unsigned: true }).notNull(),
  lineTotalMinor: bigint("line_total_minor", { mode: "number", unsigned: true }).notNull(),
  selectedOptions: json("selected_options").$type<Record<string, string>>().notNull(),
  createdAt: createdAt(),
}, (table) => [
  index("order_items_order_idx").on(table.orderId, table.createdAt),
  check("order_items_quantity_check", sql.raw("quantity BETWEEN 1 AND 100")),
  check("order_items_total_check", sql.raw("line_total_minor = quantity * unit_price_minor")),
]);

export const orderEvents = mysqlTable("order_events", {
  id: char("id", { length: 36 }).primaryKey(),
  orderId: char("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  actorType: varchar("actor_type", { length: 16 }).$type<"customer" | "admin" | "system">().notNull(),
  actorId: char("actor_id", { length: 36 }),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  fromStatus: varchar("from_status", { length: 24 }).$type<MySqlOrderStatus>(),
  toStatus: varchar("to_status", { length: 24 }).$type<MySqlOrderStatus>(),
  note: varchar("note", { length: 1000 }),
  createdAt: createdAt(),
}, (table) => [
  index("order_events_order_created_idx").on(table.orderId, table.createdAt),
  check("order_events_actor_type_check", sql.raw("actor_type IN ('customer','admin','system')")),
]);
")),
  check("payment_refunds_hash_check", sql.raw("request_hash REGEXP '^[a-f0-9]{64}
  id: char("id", { length: 36 }).primaryKey(),
  orderId: char("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  productIdSnapshot: char("product_id_snapshot", { length: 36 }).notNull(),
  variantIdSnapshot: char("variant_id_snapshot", { length: 36 }).notNull(),
  productTitle: varchar("product_title", { length: 240 }).notNull(),
  productSku: varchar("product_sku", { length: 100 }),
  variantLabel: varchar("variant_label", { length: 180 }).notNull(),
  quantity: int("quantity", { unsigned: true }).notNull(),
  unitPriceMinor: bigint("unit_price_minor", { mode: "number", unsigned: true }).notNull(),
  lineTotalMinor: bigint("line_total_minor", { mode: "number", unsigned: true }).notNull(),
  selectedOptions: json("selected_options").$type<Record<string, string>>().notNull(),
  createdAt: createdAt(),
}, (table) => [
  index("order_items_order_idx").on(table.orderId, table.createdAt),
  check("order_items_quantity_check", sql.raw("quantity BETWEEN 1 AND 100")),
  check("order_items_total_check", sql.raw("line_total_minor = quantity * unit_price_minor")),
]);

export const orderEvents = mysqlTable("order_events", {
  id: char("id", { length: 36 }).primaryKey(),
  orderId: char("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  actorType: varchar("actor_type", { length: 16 }).$type<"customer" | "admin" | "system">().notNull(),
  actorId: char("actor_id", { length: 36 }),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  fromStatus: varchar("from_status", { length: 24 }).$type<MySqlOrderStatus>(),
  toStatus: varchar("to_status", { length: 24 }).$type<MySqlOrderStatus>(),
  note: varchar("note", { length: 1000 }),
  createdAt: createdAt(),
}, (table) => [
  index("order_events_order_created_idx").on(table.orderId, table.createdAt),
  check("order_events_actor_type_check", sql.raw("actor_type IN ('customer','admin','system')")),
]);
")),
  check("payment_refunds_reason_check", sql.raw("CHAR_LENGTH(TRIM(reason)) BETWEEN 1 AND 500")),
]);

export const orderItems = mysqlTable("order_items", {
  id: char("id", { length: 36 }).primaryKey(),
  orderId: char("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  productIdSnapshot: char("product_id_snapshot", { length: 36 }).notNull(),
  variantIdSnapshot: char("variant_id_snapshot", { length: 36 }).notNull(),
  productTitle: varchar("product_title", { length: 240 }).notNull(),
  productSku: varchar("product_sku", { length: 100 }),
  variantLabel: varchar("variant_label", { length: 180 }).notNull(),
  quantity: int("quantity", { unsigned: true }).notNull(),
  unitPriceMinor: bigint("unit_price_minor", { mode: "number", unsigned: true }).notNull(),
  lineTotalMinor: bigint("line_total_minor", { mode: "number", unsigned: true }).notNull(),
  selectedOptions: json("selected_options").$type<Record<string, string>>().notNull(),
  createdAt: createdAt(),
}, (table) => [
  index("order_items_order_idx").on(table.orderId, table.createdAt),
  check("order_items_quantity_check", sql.raw("quantity BETWEEN 1 AND 100")),
  check("order_items_total_check", sql.raw("line_total_minor = quantity * unit_price_minor")),
]);

export const orderEvents = mysqlTable("order_events", {
  id: char("id", { length: 36 }).primaryKey(),
  orderId: char("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  actorType: varchar("actor_type", { length: 16 }).$type<"customer" | "admin" | "system">().notNull(),
  actorId: char("actor_id", { length: 36 }),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  fromStatus: varchar("from_status", { length: 24 }).$type<MySqlOrderStatus>(),
  toStatus: varchar("to_status", { length: 24 }).$type<MySqlOrderStatus>(),
  note: varchar("note", { length: 1000 }),
  createdAt: createdAt(),
}, (table) => [
  index("order_events_order_created_idx").on(table.orderId, table.createdAt),
  check("order_events_actor_type_check", sql.raw("actor_type IN ('customer','admin','system')")),
]);
