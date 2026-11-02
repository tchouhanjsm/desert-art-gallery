import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { closeMySqlPool, getMySqlDb, pingMySql } from "@/server/db";
import { artisanProfiles, collectionProductLinks, collections, journalPosts, siteContent } from "@/server/db/schema";
import { hasSupportedImageSignature } from "@/lib/image-signature";
import {
  readEditorialMedia,
  removeEditorialMedia,
  safeStorageKey,
  storeEditorialMedia,
  type EditorialImageMime,
  type EditorialTarget,
} from "@/server/media/storage";

type SourceSiteContent = {
  id: string;
  content_key: string;
  title: string;
  body: unknown;
  is_published: boolean;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};
type SourceCollection = {
  id: string; name: string; slug: string; description: string;
  hero_image_path: string | null; hero_image_alt: string | null;
  hero_image_rights_confirmed: boolean; hero_image_rights_evidence: string | null;
  sort_order: number; is_published: boolean; created_at: string | null; updated_at: string | null;
};
type SourceArtisan = {
  id: string; full_name: string; role_title: string; short_bio: string; biography: string;
  craft_specialties: string[] | null; years_experience: number | null; portrait_path: string | null;
  portrait_alt_text: string | null; portrait_rights_confirmed: boolean;
  portrait_rights_evidence: string | null; sort_order: number; is_published: boolean;
  created_at: string | null; updated_at: string | null;
};
type SourceJournalPost = {
  id: string; title: string; slug: string; excerpt: string; content_markdown: string; category: string;
  cover_image_path: string | null; cover_image_alt: string | null; cover_image_rights_confirmed: boolean;
  cover_image_rights_evidence: string | null; status: "draft" | "published" | "archived";
  author_id: string | null; published_at: string | null; created_at: string | null; updated_at: string | null;
};
type SourceCollectionProduct = { collection_id: string; product_id: string; sort_order: number };


const importMarker = "__legacy_supabase_editorial_import_v1";
const commitMode = process.argv.includes("--commit");
const maxRows = 1000;
const maxImageBytes = 12 * 1024 * 1024;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + " must be configured in .env before importing editorial content.");
  return value;
}

function asDate(value: string | null): Date {
  if (!value) return new Date();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Source data contains an invalid timestamp: " + value);
  return date;
}

function asBody(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function revokeInvalidHomepageImageRights(body: Record<string, unknown>): Record<string, unknown> {
  const next = { ...body };
  if (next.hero_image_rights_confirmed === true) {
    const hasAlt = typeof next.hero_image_alt === "string" && next.hero_image_alt.trim().length > 0;
    const hasEvidence = typeof next.hero_image_rights_evidence === "string" && next.hero_image_rights_evidence.trim().length > 0;
    if (!hasAlt || !hasEvidence) next.hero_image_rights_confirmed = false;
  }
  return next;
}

function mediaEntries(
  home: SourceSiteContent[],
  collectionRows: SourceCollection[],
  artisanRows: SourceArtisan[],
  journalRows: SourceJournalPost[],
): { target: EditorialTarget; id: string; key: string }[] {
  const result: { target: EditorialTarget; id: string; key: string }[] = [];
  for (const row of home) {
    const path = asBody(row.body).hero_image_path;
    if (typeof path === "string" && path) result.push({ target: "homepage", id: row.id, key: path });
  }
  for (const row of collectionRows) {
    if (row.hero_image_path) result.push({ target: "collection", id: row.id, key: row.hero_image_path });
  }
  for (const row of artisanRows) {
    if (row.portrait_path) result.push({ target: "artisan", id: row.id, key: row.portrait_path });
  }
  for (const row of journalRows) {
    if (row.cover_image_path) result.push({ target: "journal", id: row.id, key: row.cover_image_path });
  }
  return result;
}

function validateMediaReference(item: { target: EditorialTarget; id: string; key: string }): string {
  const safe = safeStorageKey(item.key);
  const parts = safe.split("/");
  if (parts[1] !== item.target || parts[2] !== item.id) {
    throw new Error("Editorial media path is attached to an unexpected record: " + safe);
  }
  return safe;
}

async function main() {
  const siteUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!(await pingMySql())) throw new Error("Unable to connect to MySQL. Apply Drizzle migrations before importing content.");

  const supabase = createClient(siteUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const [homeResult, collectionResult, artisanResult, journalResult, productLinksResult] = await Promise.all([
    supabase.from("site_content").select("*").eq("content_key", "homepage").limit(maxRows),
    supabase.from("collections").select("*").limit(maxRows),
    supabase.from("artisan_profiles").select("*").limit(maxRows),
    supabase.from("journal_posts").select("*").limit(maxRows),
    supabase.from("collection_products").select("collection_id,product_id,sort_order").limit(maxRows),
  ]);
  for (const result of [homeResult, collectionResult, artisanResult, journalResult, productLinksResult]) {
    if (result.error) throw new Error("Could not read all legacy editorial data: " + result.error.message);
    if ((result.data?.length ?? 0) >= maxRows) throw new Error("An editorial table reached the " + maxRows + " row safety limit. Raise the cap after reviewing the data volume.");
  }

  const home = (homeResult.data ?? []) as unknown as SourceSiteContent[];
  const collectionRows = (collectionResult.data ?? []) as unknown as SourceCollection[];
  const artisanRows = (artisanResult.data ?? []) as unknown as SourceArtisan[];
  const journalRows = (journalResult.data ?? []) as unknown as SourceJournalPost[];
  const productLinks = (productLinksResult.data ?? []) as unknown as SourceCollectionProduct[];
  const productIds = [...new Set(productLinks.map((link) => link.product_id))];
  const productSlugRows: { id: string; slug: string }[] = [];
  for (let offset = 0; offset < productIds.length; offset += 200) {
    const batch = productIds.slice(offset, offset + 200);
    const { data, error } = await supabase.from("products").select("id,slug").in("id", batch).limit(200);
    if (error) throw new Error("Could not read product slugs for collection assignments: " + error.message);
    productSlugRows.push(...(data ?? []));
  }
  const productSlugById = new Map(productSlugRows.map((row) => [row.id, row.slug]));
  const collectionIds = new Set(collectionRows.map((row) => row.id));
  const collectionProductRows = productLinks.flatMap((link) => {
    const productSlug = productSlugById.get(link.product_id);
    if (!collectionIds.has(link.collection_id) || !productSlug) return [];
    return [{ collectionId: link.collection_id, productSlug, sortOrder: link.sort_order ?? 0 }];
  });
  if (collectionProductRows.length !== productLinks.length) {
    throw new Error("Legacy collection product assignments contain a missing collection or product. Resolve the broken links before importing.");
  }
  const entries = mediaEntries(home, collectionRows, artisanRows, journalRows);
  const uniqueEntries = [...new Map(entries.map((item) => [validateMediaReference(item), item])).values()];
  const summary = {
    homepageRecords: home.length,
    collections: collectionRows.length,
    makerProfiles: artisanRows.length,
    journalPosts: journalRows.length,
    collectionProductAssignments: collectionProductRows.length,
    editorialMediaObjects: uniqueEntries.length,
    mode: commitMode ? "COMMIT" : "DRY RUN",
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!commitMode) {
    console.log("Dry run only. No MySQL records or media files were written. Re-run with --commit to import.");
    return;
  }

  const db = getMySqlDb();
  const [marker] = await db.select({ id: siteContent.id }).from(siteContent)
    .where(eq(siteContent.contentKey, importMarker)).limit(1);
  if (marker) throw new Error("This legacy editorial import has already completed. Refusing to overwrite later owner edits.");

  const [existingHome, existingCollections, existingArtisans, existingJournal, existingLinks] = await Promise.all([
    db.select({ id: siteContent.id }).from(siteContent).limit(1),
    db.select({ id: collections.id }).from(collections).limit(1),
    db.select({ id: artisanProfiles.id }).from(artisanProfiles).limit(1),
    db.select({ id: journalPosts.id }).from(journalPosts).limit(1),
    db.select({ id: collectionProductLinks.id }).from(collectionProductLinks).limit(1),
  ]);
  if (existingHome.length || existingCollections.length || existingArtisans.length || existingJournal.length || existingLinks.length) {
    throw new Error("The MySQL editorial tables are not empty. This importer only seeds an empty editorial database; it will not merge or overwrite newer owner data.");
  }

  const copiedFiles: string[] = [];
  try {
    for (const entry of uniqueEntries) {
      const key = validateMediaReference(entry);
      if (await readEditorialMedia(key)) continue;

      const { data, error } = await supabase.storage.from("product-media").download(key);
      if (error || !data) throw new Error("Unable to download legacy editorial media " + key + ": " + (error?.message ?? "file not found"));
      if (data.size <= 0 || data.size > maxImageBytes) throw new Error("Legacy image exceeds the 12 MB migration limit: " + key);

      const extension = key.split(".").pop()?.toLowerCase();
      const expectedMime: Record<string, EditorialImageMime> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif",
      };
      const mime = expectedMime[extension ?? ""];
      if (!mime || (data.type && data.type !== mime)) throw new Error("Legacy media MIME type does not match its storage extension: " + key);
      const bytes = new Uint8Array(await data.arrayBuffer());
      if (!hasSupportedImageSignature(mime, bytes.slice(0, 64))) {
        throw new Error("Legacy media file signature is invalid: " + key);
      }
      await storeEditorialMedia(key, bytes);
      copiedFiles.push(key);
    }

    await db.transaction(async (tx) => {
      for (const row of home) {
        const now = new Date();
        const body = revokeInvalidHomepageImageRights(asBody(row.body));
        await tx.insert(siteContent).values({
          id: row.id, contentKey: row.content_key, title: row.title ?? "",
          body, isPublished: Boolean(row.is_published), updatedBy: row.updated_by,
          createdAt: asDate(row.created_at), updatedAt: asDate(row.updated_at ?? now.toISOString()),
        });
      }

      for (const row of collectionRows) {
        const confirmed = Boolean(row.hero_image_rights_confirmed) &&
          Boolean(row.hero_image_alt?.trim()) && Boolean(row.hero_image_rights_evidence?.trim());
        await tx.insert(collections).values({
          id: row.id, name: row.name, slug: row.slug, description: row.description ?? "",
          heroImagePath: row.hero_image_path, heroImageAlt: row.hero_image_alt ?? "",
          heroImageRightsConfirmed: confirmed, heroImageRightsEvidence: row.hero_image_rights_evidence ?? "",
          sortOrder: row.sort_order ?? 0, isPublished: Boolean(row.is_published),
          createdAt: asDate(row.created_at), updatedAt: asDate(row.updated_at),
        });
      }

      for (const link of collectionProductRows) {
        await tx.insert(collectionProductLinks).values({
          id: randomUUID(),
          collectionId: link.collectionId,
          productSlug: link.productSlug,
          sortOrder: link.sortOrder,
          createdAt: new Date(),
        });
      }

      for (const row of artisanRows) {
        const confirmed = Boolean(row.portrait_rights_confirmed) &&
          Boolean(row.portrait_alt_text?.trim()) && Boolean(row.portrait_rights_evidence?.trim());
        await tx.insert(artisanProfiles).values({
          id: row.id, fullName: row.full_name, roleTitle: row.role_title ?? "",
          shortBio: row.short_bio ?? "", biography: row.biography ?? "",
          craftSpecialties: Array.isArray(row.craft_specialties) ? row.craft_specialties : [],
          yearsExperience: row.years_experience, portraitPath: row.portrait_path,
          portraitAltText: row.portrait_alt_text ?? "", portraitRightsConfirmed: confirmed,
          portraitRightsEvidence: row.portrait_rights_evidence ?? "", sortOrder: row.sort_order ?? 0,
          isPublished: Boolean(row.is_published), createdAt: asDate(row.created_at), updatedAt: asDate(row.updated_at),
        });
      }

      for (const row of journalRows) {
        const confirmed = Boolean(row.cover_image_rights_confirmed) &&
          Boolean(row.cover_image_alt?.trim()) && Boolean(row.cover_image_rights_evidence?.trim());
        await tx.insert(journalPosts).values({
          id: row.id, title: row.title, slug: row.slug, excerpt: row.excerpt ?? "",
          contentMarkdown: row.content_markdown ?? "", category: row.category ?? "Stories",
          coverImagePath: row.cover_image_path, coverImageAlt: row.cover_image_alt ?? "",
          coverImageRightsConfirmed: confirmed, coverImageRightsEvidence: row.cover_image_rights_evidence ?? "",
          status: row.status, authorId: row.author_id, publishedAt: row.published_at ? asDate(row.published_at) : null,
          createdAt: asDate(row.created_at), updatedAt: asDate(row.updated_at),
        });
      }

      await tx.insert(siteContent).values({
        id: randomUUID(),
        contentKey: importMarker,
        title: "Legacy Supabase editorial import marker",
        body: {
          source: "supabase",
          imported_at: new Date().toISOString(),
          ...summary,
          media_paths: uniqueEntries.map((entry) => entry.key),
          rights_approvals_revoked: {
            collections: collectionRows.filter((row) => row.hero_image_rights_confirmed && (!row.hero_image_alt?.trim() || !row.hero_image_rights_evidence?.trim())).length,
            makers: artisanRows.filter((row) => row.portrait_rights_confirmed && (!row.portrait_alt_text?.trim() || !row.portrait_rights_evidence?.trim())).length,
            journal: journalRows.filter((row) => row.cover_image_rights_confirmed && (!row.cover_image_alt?.trim() || !row.cover_image_rights_evidence?.trim())).length,
          },
        },
        isPublished: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    console.log("Editorial content and media imported successfully. Existing owner content was not overwritten.");
  } catch (error) {
    await Promise.all(copiedFiles.map((key) => removeEditorialMedia(key).catch(() => undefined)));
    throw error;
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Editorial import failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMySqlPool().catch(() => undefined);
  });
