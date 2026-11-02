import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  datetime,
  index,
  int,
  json,
  mysqlTable,
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
