import { sql } from "drizzle-orm";
import {
  bigint, boolean, char, datetime, index, int, json, mysqlTable,
  smallint, text, uniqueIndex, varchar,
} from "drizzle-orm/mysql-core";

const id = (name = "id") => char(name, { length: 36 });
const createdAt = () => datetime("created_at", { mode: "date", fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`);
const updatedAt = () => datetime("updated_at", { mode: "date", fsp: 3 })
  .notNull().default(sql`CURRENT_TIMESTAMP(3)`).$onUpdateFn(() => new Date());
const money = (name: string) => bigint(name, { mode: "number" });

export const users = mysqlTable("users", {
  id: id().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 160 }).notNull().default(""),
  phone: varchar("phone", { length: 40 }).notNull().default(""),
  role: varchar("role", { length: 16 }).notNull().default("customer"),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  emailVerifiedAt: datetime("email_verified_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("users_email_uq").on(t.email),
  index("users_role_status_idx").on(t.role, t.status),
]);

export const userSessions = mysqlTable("user_sessions", {
  id: id().primaryKey(),
  userId: id("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: char("token_hash", { length: 64 }).notNull(),
  expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("user_sessions_token_hash_uq").on(t.tokenHash),
  index("user_sessions_user_expiry_idx").on(t.userId, t.expiresAt),
]);

export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: id().primaryKey(),
  userId: id("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: char("token_hash", { length: 64 }).notNull(),
  expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
  consumedAt: datetime("consumed_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("password_reset_tokens_hash_uq").on(t.tokenHash),
  index("password_reset_tokens_user_expiry_idx").on(t.userId, t.expiresAt),
]);

export const categories = mysqlTable("categories", {
  id: id().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  description: text("description").notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("categories_slug_uq").on(t.slug)]);

export const collections = mysqlTable("collections", {
  id: id().primaryKey(),
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
}, (t) => [
  uniqueIndex("collections_slug_uq").on(t.slug),
  index("collections_public_order_idx").on(t.isPublished, t.sortOrder, t.name),
]);

export const products = mysqlTable("products", {
  id: id().primaryKey(),
  categoryId: id("category_id").references(() => categories.id, { onDelete: "set null" }),
  title: varchar("title", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  shortDescription: varchar("short_description", { length: 500 }).notNull().default(""),
  description: text("description").notNull(),
  sku: varchar("sku", { length: 80 }),
  currency: char("currency", { length: 3 }).notNull().default("INR"),
  priceMinor: money("price_minor"),
  compareAtPriceMinor: money("compare_at_price_minor"),
  quantityOnHand: int("quantity_on_hand").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  isOneOfAKind: boolean("is_one_of_a_kind").notNull().default(false),
  materials: json("materials").$type<string[]>().notNull(),
  sizes: json("sizes").$type<string[]>().notNull(),
  measurements: json("measurements").$type<Record<string, unknown>>().notNull(),
  conditionNotes: text("condition_notes").notNull(),
  provenance: text("provenance").notNull(),
  craftStory: text("craft_story").notNull(),
  seoTitle: varchar("seo_title", { length: 180 }),
  seoDescription: varchar("seo_description", { length: 320 }),
  publishedAt: datetime("published_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("products_slug_uq").on(t.slug),
  uniqueIndex("products_sku_uq").on(t.sku),
  index("products_status_published_idx").on(t.status, t.publishedAt),
  index("products_category_idx").on(t.categoryId),
  index("products_updated_idx").on(t.updatedAt),
]);

export const productImages = mysqlTable("product_images", {
  id: id().primaryKey(),
  productId: id("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  storagePath: varchar("storage_path", { length: 512 }).notNull(),
  altText: varchar("alt_text", { length: 300 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
  rightsConfirmed: boolean("rights_confirmed").notNull().default(false),
  rightsEvidence: varchar("rights_evidence", { length: 1000 }).notNull().default(""),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("product_images_storage_path_uq").on(t.storagePath),
  index("product_images_product_order_idx").on(t.productId, t.sortOrder),
  index("product_images_public_idx").on(t.productId, t.rightsConfirmed),
]);

export const productCollectionLinks = mysqlTable("product_collection_links", {
  id: id().primaryKey(),
  collectionId: id("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  productId: id("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("product_collection_pair_uq").on(t.collectionId, t.productId),
  index("product_collection_product_idx").on(t.productId),
]);

export const productVariants = mysqlTable("product_variants", {
  id: id().primaryKey(),
  productId: id("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sku: varchar("sku", { length: 80 }),
  label: varchar("label", { length: 120 }).notNull(),
  attributes: json("attributes").$type<Record<string, unknown>>().notNull(),
  priceOverrideMinor: money("price_override_minor"),
  quantityOnHand: int("quantity_on_hand").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("product_variants_sku_uq").on(t.sku),
  uniqueIndex("product_variants_product_label_uq").on(t.productId, t.label),
  index("product_variants_product_status_idx").on(t.productId, t.status, t.sortOrder),
]);

export const inventoryMovements = mysqlTable("inventory_movements", {
  id: id().primaryKey(),
  productId: id("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  variantId: id("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  quantityDelta: int("quantity_delta").notNull(),
  reason: varchar("reason", { length: 40 }).notNull(),
  reference: varchar("reference", { length: 160 }),
  actorId: id("actor_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [
  index("inventory_movements_product_date_idx").on(t.productId, t.createdAt),
  index("inventory_movements_variant_date_idx").on(t.variantId, t.createdAt),
]);

export const inventoryReservations = mysqlTable("inventory_reservations", {
  id: id().primaryKey(),
  userId: id("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
  requestHash: char("request_hash", { length: 64 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("reserved"),
  expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("inventory_reservations_user_key_uq").on(t.userId, t.idempotencyKey),
  index("inventory_reservations_status_expiry_idx").on(t.status, t.expiresAt),
]);

export const inventoryReservationItems = mysqlTable("inventory_reservation_items", {
  id: id().primaryKey(),
  reservationId: id("reservation_id").notNull().references(() => inventoryReservations.id, { onDelete: "cascade" }),
  productId: id("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  variantId: id("variant_id").references(() => productVariants.id, { onDelete: "restrict" }),
  productTitle: varchar("product_title", { length: 180 }).notNull(),
  productSku: varchar("product_sku", { length: 80 }),
  variantLabel: varchar("variant_label", { length: 120 }),
  selectedOptions: json("selected_options").$type<Record<string, unknown>>().notNull(),
  quantity: int("quantity").notNull(),
  unitPriceMinor: money("unit_price_minor").notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("reservation_product_variant_uq").on(t.reservationId, t.productId, t.variantId),
  index("reservation_stock_lookup_idx").on(t.productId, t.variantId, t.reservationId),
]);

export const addresses = mysqlTable("addresses", {
  id: id().primaryKey(),
  userId: id("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientName: varchar("recipient_name", { length: 160 }).notNull(),
  addressLine1: varchar("address_line_1", { length: 240 }).notNull(),
  addressLine2: varchar("address_line_2", { length: 240 }),
  city: varchar("city", { length: 120 }).notNull(),
  region: varchar("region", { length: 120 }),
  postalCode: varchar("postal_code", { length: 24 }).notNull(),
  countryCode: char("country_code", { length: 2 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  isDefaultShipping: boolean("is_default_shipping").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("addresses_user_default_idx").on(t.userId, t.isDefaultShipping)]);

export const orders = mysqlTable("orders", {
  id: id().primaryKey(),
  orderNumber: varchar("order_number", { length: 40 }).notNull(),
  userId: id("user_id").references(() => users.id, { onDelete: "set null" }),
  email: varchar("email", { length: 320 }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("draft"),
  subtotalMinor: money("subtotal_minor").notNull(),
  shippingMinor: money("shipping_minor").notNull().default(0),
  taxMinor: money("tax_minor").notNull().default(0),
  discountMinor: money("discount_minor").notNull().default(0),
  totalMinor: money("total_minor").notNull(),
  shippingAddress: json("shipping_address").$type<Record<string, unknown>>().notNull(),
  billingAddress: json("billing_address").$type<Record<string, unknown>>(),
  customerNote: text("customer_note"),
  reservationId: id("reservation_id").references(() => inventoryReservations.id, { onDelete: "set null" }),
  checkoutIdempotencyKey: char("checkout_idempotency_key", { length: 36 }),
  checkoutRequestHash: char("checkout_request_hash", { length: 64 }),
  expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }),
  shippingRateId: id("shipping_rate_id"),
  shippingZoneName: varchar("shipping_zone_name", { length: 120 }),
  shippingRateName: varchar("shipping_rate_name", { length: 160 }),
  shippingDeliveryMinDays: int("shipping_delivery_min_days"),
  shippingDeliveryMaxDays: int("shipping_delivery_max_days"),
  dutiesDisclosure: text("duties_disclosure"),
  taxBreakdown: json("tax_breakdown").$type<Array<Record<string, unknown>>>().notNull(),
  taxDisclosure: text("tax_disclosure").notNull(),
  trackingCarrier: varchar("tracking_carrier", { length: 120 }),
  trackingNumber: varchar("tracking_number", { length: 160 }),
  trackingUrl: varchar("tracking_url", { length: 1000 }),
  placedAt: datetime("placed_at", { mode: "date", fsp: 3 }).notNull(),
  shippedAt: datetime("shipped_at", { mode: "date", fsp: 3 }),
  deliveredAt: datetime("delivered_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("orders_number_uq").on(t.orderNumber),
  uniqueIndex("orders_reservation_uq").on(t.reservationId),
  uniqueIndex("orders_user_idempotency_uq").on(t.userId, t.checkoutIdempotencyKey),
  index("orders_user_date_idx").on(t.userId, t.createdAt),
  index("orders_status_date_idx").on(t.status, t.createdAt),
]);

export const orderItems = mysqlTable("order_items", {
  id: id().primaryKey(),
  orderId: id("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: id("product_id").references(() => products.id, { onDelete: "set null" }),
  variantId: id("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  productTitle: varchar("product_title", { length: 180 }).notNull(),
  productSku: varchar("product_sku", { length: 80 }),
  variantLabel: varchar("variant_label", { length: 120 }),
  quantity: int("quantity").notNull(),
  unitPriceMinor: money("unit_price_minor").notNull(),
  lineTotalMinor: money("line_total_minor").notNull(),
  selectedOptions: json("selected_options").$type<Record<string, unknown>>().notNull(),
  createdAt: createdAt(),
}, (t) => [index("order_items_order_idx").on(t.orderId)]);

export const cartItems = mysqlTable("cart_items", {
  id: id().primaryKey(),
  userId: id("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: id("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  variantId: id("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
  quantity: int("quantity").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("cart_items_user_idx").on(t.userId)]);

export const wishlistItems = mysqlTable("wishlist_items", {
  userId: id("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: id("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("wishlist_items_user_product_uq").on(t.userId, t.productId),
]);

export const discountCodes = mysqlTable("discount_codes", {
  id: id().primaryKey(),
  code: varchar("code", { length: 80 }).notNull(),
  description: varchar("description", { length: 500 }).notNull().default(""),
  discountType: varchar("discount_type", { length: 16 }).notNull(),
  discountValue: int("discount_value").notNull(),
  currency: char("currency", { length: 3 }),
  startsAt: datetime("starts_at", { mode: "date", fsp: 3 }),
  endsAt: datetime("ends_at", { mode: "date", fsp: 3 }),
  usageLimit: int("usage_limit"),
  usageCount: int("usage_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("discount_codes_code_uq").on(t.code)]);

export const shippingZones = mysqlTable("shipping_zones", {
  id: id().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  countryCodes: json("country_codes").$type<string[]>().notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const shippingRates = mysqlTable("shipping_rates", {
  id: id().primaryKey(),
  zoneId: id("zone_id").notNull().references(() => shippingZones.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  amountMinor: money("amount_minor").notNull(),
  minDeliveryDays: int("min_delivery_days"),
  maxDeliveryDays: int("max_delivery_days"),
  dutiesDisclosure: text("duties_disclosure").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("shipping_rates_zone_active_idx").on(t.zoneId, t.isActive)]);

export const checkoutTaxRules = mysqlTable("checkout_tax_rules", {
  id: id().primaryKey(),
  countryCode: char("country_code", { length: 2 }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  taxName: varchar("tax_name", { length: 120 }).notNull(),
  rateBasisPoints: int("rate_basis_points").notNull(),
  taxableShipping: boolean("taxable_shipping").notNull().default(false),
  disclosure: varchar("disclosure", { length: 2000 }).notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("checkout_tax_rule_destination_uq").on(t.countryCode, t.currency, t.taxName)]);

export const siteContent = mysqlTable("site_content", {
  id: id().primaryKey(),
  contentKey: varchar("content_key", { length: 120 }).notNull(),
  title: varchar("title", { length: 255 }).notNull().default(""),
  body: json("body").$type<Record<string, unknown>>().notNull(),
  isPublished: boolean("is_published").notNull().default(false),
  updatedBy: id("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("site_content_key_uq").on(t.contentKey),
  index("site_content_published_idx").on(t.isPublished, t.contentKey),
]);

export const artisanProfiles = mysqlTable("artisan_profiles", {
  id: id().primaryKey(),
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
}, (t) => [index("artisan_profiles_public_order_idx").on(t.isPublished, t.sortOrder, t.fullName)]);

export const journalPosts = mysqlTable("journal_posts", {
  id: id().primaryKey(),
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
  authorId: id("author_id").references(() => users.id, { onDelete: "set null" }),
  publishedAt: datetime("published_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("journal_posts_slug_uq").on(t.slug),
  index("journal_posts_publication_idx").on(t.status, t.publishedAt),
]);

export const customerReviews = mysqlTable("customer_reviews", {
  id: id().primaryKey(),
  userId: id("user_id").references(() => users.id, { onDelete: "set null" }),
  productId: id("product_id").references(() => products.id, { onDelete: "set null" }),
  customerDisplayName: varchar("customer_display_name", { length: 160 }).notNull(),
  rating: smallint("rating").notNull(),
  reviewText: text("review_text").notNull(),
  moderationStatus: varchar("moderation_status", { length: 16 }).notNull().default("pending"),
  source: varchar("source", { length: 16 }).notNull().default("website"),
  permissionConfirmed: boolean("permission_confirmed").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("customer_reviews_product_status_idx").on(t.productId, t.moderationStatus)]);

export const newsletterSubscribers = mysqlTable("newsletter_subscribers", {
  id: id().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  consentAt: datetime("consent_at", { mode: "date", fsp: 3 }).notNull(),
  confirmationTokenHash: char("confirmation_token_hash", { length: 64 }),
  unsubscribeTokenHash: char("unsubscribe_token_hash", { length: 64 }).notNull(),
  source: varchar("source", { length: 80 }).notNull().default("website"),
  confirmedAt: datetime("confirmed_at", { mode: "date", fsp: 3 }),
  unsubscribedAt: datetime("unsubscribed_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("newsletter_email_uq").on(t.email),
  uniqueIndex("newsletter_unsubscribe_token_uq").on(t.unsubscribeTokenHash),
]);

export const catalogueImportBatches = mysqlTable("catalogue_import_batches", {
  id: id().primaryKey(),
  createdBy: id("created_by").references(() => users.id, { onDelete: "set null" }),
  rowCount: int("row_count").notNull(),
  productsCreated: int("products_created").notNull(),
  stockUnitsAdded: bigint("stock_units_added", { mode: "number" }).notNull(),
  createdAt: createdAt(),
});

export const auditLog = mysqlTable("audit_log", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  actorId: id("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 16 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: varchar("entity_id", { length: 120 }),
  metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
  createdAt: createdAt(),
}, (t) => [index("audit_log_entity_created_idx").on(t.entityType, t.entityId, t.createdAt)]);

export const paymentWebhookEvents = mysqlTable("payment_webhook_events", {
  id: id().primaryKey(),
  provider: varchar("provider", { length: 24 }).notNull(),
  providerEventId: varchar("provider_event_id", { length: 180 }).notNull(),
  eventType: varchar("event_type", { length: 120 }).notNull(),
  payloadHash: char("payload_hash", { length: 64 }).notNull(),
  processedAt: datetime("processed_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("payment_webhook_provider_event_uq").on(t.provider, t.providerEventId)]);
