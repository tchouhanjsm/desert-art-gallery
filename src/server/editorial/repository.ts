import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getMySqlDb } from "@/server/db";
import { artisanProfiles, collections, journalPosts, siteContent } from "@/server/db/schema";
import type { EditorialTarget } from "@/server/media/storage";

export type HomepageBody = Record<string, unknown>;
export type HomepageRecord = {
  id: string;
  title: string;
  body: HomepageBody;
  is_published: boolean;
  updated_at: Date;
};
export type CollectionRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  hero_image_path: string | null;
  hero_image_alt: string;
  hero_image_rights_confirmed: boolean;
  hero_image_rights_evidence: string;
  sort_order: number;
  is_published: boolean;
};
export type ArtisanRecord = {
  id: string;
  full_name: string;
  role_title: string;
  short_bio: string;
  biography: string;
  craft_specialties: string[];
  years_experience: number | null;
  portrait_path: string | null;
  portrait_alt_text: string;
  portrait_rights_confirmed: boolean;
  portrait_rights_evidence: string;
  sort_order: number;
  is_published: boolean;
};
export type JournalRecord = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content_markdown: string;
  category: string;
  cover_image_path: string | null;
  cover_image_alt: string;
  cover_image_rights_confirmed: boolean;
  cover_image_rights_evidence: string;
  status: "draft" | "published" | "archived";
  author_id: string | null;
  published_at: Date | null;
};

function toCollection(row: typeof collections.$inferSelect): CollectionRecord {
  return {
    id: row.id, name: row.name, slug: row.slug, description: row.description,
    hero_image_path: row.heroImagePath, hero_image_alt: row.heroImageAlt,
    hero_image_rights_confirmed: row.heroImageRightsConfirmed,
    hero_image_rights_evidence: row.heroImageRightsEvidence,
    sort_order: row.sortOrder, is_published: row.isPublished,
  };
}

function toArtisan(row: typeof artisanProfiles.$inferSelect): ArtisanRecord {
  return {
    id: row.id, full_name: row.fullName, role_title: row.roleTitle,
    short_bio: row.shortBio, biography: row.biography,
    craft_specialties: row.craftSpecialties ?? [], years_experience: row.yearsExperience,
    portrait_path: row.portraitPath, portrait_alt_text: row.portraitAltText,
    portrait_rights_confirmed: row.portraitRightsConfirmed,
    portrait_rights_evidence: row.portraitRightsEvidence,
    sort_order: row.sortOrder, is_published: row.isPublished,
  };
}

function toJournal(row: typeof journalPosts.$inferSelect): JournalRecord {
  return {
    id: row.id, title: row.title, slug: row.slug, excerpt: row.excerpt,
    content_markdown: row.contentMarkdown, category: row.category,
    cover_image_path: row.coverImagePath, cover_image_alt: row.coverImageAlt,
    cover_image_rights_confirmed: row.coverImageRightsConfirmed,
    cover_image_rights_evidence: row.coverImageRightsEvidence,
    status: row.status as JournalRecord["status"], author_id: row.authorId,
    published_at: row.publishedAt,
  };
}

export async function getHomepageRecord(): Promise<HomepageRecord | null> {
  const [row] = await getMySqlDb().select().from(siteContent).where(eq(siteContent.contentKey, "homepage")).limit(1);
  return row ? {
    id: row.id,
    title: row.title,
    body: row.body ?? {},
    is_published: row.isPublished,
    updated_at: row.updatedAt,
  } : null;
}

export async function getPublishedHomepageRecord(): Promise<HomepageRecord | null> {
  const [row] = await getMySqlDb().select().from(siteContent)
    .where(and(eq(siteContent.contentKey, "homepage"), eq(siteContent.isPublished, true))).limit(1);
  return row ? {
    id: row.id, title: row.title, body: row.body ?? {},
    is_published: row.isPublished, updated_at: row.updatedAt,
  } : null;
}

export async function saveHomepageRecord(body: HomepageBody, isPublished: boolean, updatedBy: string): Promise<void> {
  const db = getMySqlDb();
  const existing = await getHomepageRecord();
  const now = new Date();
  if (existing) {
    await db.update(siteContent).set({ title: "Homepage", body, isPublished, updatedBy, updatedAt: now })
      .where(eq(siteContent.id, existing.id));
  } else {
    await db.insert(siteContent).values({
      id: randomUUID(), contentKey: "homepage", title: "Homepage",
      body, isPublished, updatedBy, createdAt: now, updatedAt: now,
    });
  }
}

export async function listCollections(): Promise<CollectionRecord[]> {
  const rows = await getMySqlDb().select().from(collections)
    .orderBy(asc(collections.sortOrder), asc(collections.name));
  return rows.map(toCollection);
}

export async function getPublishedCollections(): Promise<CollectionRecord[]> {
  const rows = await getMySqlDb().select().from(collections)
    .where(eq(collections.isPublished, true))
    .orderBy(asc(collections.sortOrder), asc(collections.name));
  return rows.map(toCollection);
}

export async function getCollection(id: string): Promise<CollectionRecord | null> {
  const [row] = await getMySqlDb().select().from(collections).where(eq(collections.id, id)).limit(1);
  return row ? toCollection(row) : null;
}

export async function saveCollectionRecord(input: {
  id?: string; name: string; slug: string; description: string;
  sortOrder: number; isPublished: boolean;
}): Promise<void> {
  const db = getMySqlDb();
  const now = new Date();
  if (input.id) {
    const current = await getCollection(input.id);
    if (!current) throw new Error("Collection was not found.");
    if (input.isPublished && current.hero_image_path &&
      (!current.hero_image_rights_confirmed || !current.hero_image_rights_evidence.trim() || !current.hero_image_alt.trim())) {
      throw new Error("Confirm image rights and provide descriptive alt text before publishing this collection.");
    }
    await db.update(collections).set({
      name: input.name, slug: input.slug, description: input.description,
      sortOrder: input.sortOrder, isPublished: input.isPublished, updatedAt: now,
    }).where(eq(collections.id, input.id));
  } else {
    if (input.isPublished) throw new Error("New collections must be saved as drafts first.");
    await db.insert(collections).values({
      id: randomUUID(), name: input.name, slug: input.slug, description: input.description,
      sortOrder: input.sortOrder, isPublished: false, createdAt: now, updatedAt: now,
    });
  }
}

export async function listArtisanProfiles(): Promise<ArtisanRecord[]> {
  const rows = await getMySqlDb().select().from(artisanProfiles)
    .orderBy(asc(artisanProfiles.sortOrder), asc(artisanProfiles.fullName));
  return rows.map(toArtisan);
}

export async function getPublishedArtisanProfiles(): Promise<ArtisanRecord[]> {
  const rows = await getMySqlDb().select().from(artisanProfiles)
    .where(eq(artisanProfiles.isPublished, true))
    .orderBy(asc(artisanProfiles.sortOrder), asc(artisanProfiles.fullName));
  return rows.map(toArtisan);
}

export async function getArtisanProfile(id: string): Promise<ArtisanRecord | null> {
  const [row] = await getMySqlDb().select().from(artisanProfiles).where(eq(artisanProfiles.id, id)).limit(1);
  return row ? toArtisan(row) : null;
}

export async function saveArtisanRecord(input: {
  id?: string; fullName: string; roleTitle: string; shortBio: string; biography: string;
  specialties: string[]; yearsExperience: number | null; sortOrder: number; isPublished: boolean;
}): Promise<void> {
  const db = getMySqlDb();
  const now = new Date();
  if (input.id) {
    const current = await getArtisanProfile(input.id);
    if (!current) throw new Error("Maker profile was not found.");
    if (input.isPublished && current.portrait_path &&
      (!current.portrait_rights_confirmed || !current.portrait_rights_evidence.trim() || !current.portrait_alt_text.trim())) {
      throw new Error("Confirm portrait rights and provide descriptive alt text before publishing this profile.");
    }
    await db.update(artisanProfiles).set({
      fullName: input.fullName, roleTitle: input.roleTitle, shortBio: input.shortBio,
      biography: input.biography, craftSpecialties: input.specialties,
      yearsExperience: input.yearsExperience, sortOrder: input.sortOrder,
      isPublished: input.isPublished, updatedAt: now,
    }).where(eq(artisanProfiles.id, input.id));
  } else {
    if (input.isPublished) throw new Error("New maker profiles must be saved as drafts first.");
    await db.insert(artisanProfiles).values({
      id: randomUUID(), fullName: input.fullName, roleTitle: input.roleTitle,
      shortBio: input.shortBio, biography: input.biography, craftSpecialties: input.specialties,
      yearsExperience: input.yearsExperience, sortOrder: input.sortOrder, isPublished: false,
      createdAt: now, updatedAt: now,
    });
  }
}

export async function listJournalPosts(): Promise<JournalRecord[]> {
  const rows = await getMySqlDb().select().from(journalPosts).orderBy(desc(journalPosts.updatedAt));
  return rows.map(toJournal);
}

export async function getPublishedJournalPosts(): Promise<JournalRecord[]> {
  const rows = await getMySqlDb().select().from(journalPosts)
    .where(and(eq(journalPosts.status, "published"), isNotNull(journalPosts.publishedAt)))
    .orderBy(desc(journalPosts.publishedAt));
  return rows.map(toJournal);
}

export async function getPublishedJournalPost(slug: string): Promise<JournalRecord | null> {
  const [row] = await getMySqlDb().select().from(journalPosts)
    .where(and(eq(journalPosts.slug, slug), eq(journalPosts.status, "published"), isNotNull(journalPosts.publishedAt)))
    .limit(1);
  return row ? toJournal(row) : null;
}

export async function getJournalPost(id: string): Promise<JournalRecord | null> {
  const [row] = await getMySqlDb().select().from(journalPosts).where(eq(journalPosts.id, id)).limit(1);
  return row ? toJournal(row) : null;
}

export async function saveJournalRecord(input: {
  id?: string; title: string; slug: string; excerpt: string; contentMarkdown: string;
  category: string; status: JournalRecord["status"]; authorId: string;
}): Promise<void> {
  const db = getMySqlDb();
  const now = new Date();
  if (input.id) {
    const current = await getJournalPost(input.id);
    if (!current) throw new Error("Journal story was not found.");
    if (input.status === "published" && current.cover_image_path &&
      (!current.cover_image_rights_confirmed || !current.cover_image_rights_evidence.trim() || !current.cover_image_alt.trim())) {
      throw new Error("Confirm cover image rights and provide descriptive alt text before publishing this story.");
    }
    await db.update(journalPosts).set({
      title: input.title, slug: input.slug, excerpt: input.excerpt,
      contentMarkdown: input.contentMarkdown, category: input.category,
      status: input.status,
      publishedAt: input.status === "published" ? current.published_at ?? now : null,
      updatedAt: now,
    }).where(eq(journalPosts.id, input.id));
  } else {
    if (input.status !== "draft") throw new Error("New stories must be saved as drafts first.");
    await db.insert(journalPosts).values({
      id: randomUUID(), title: input.title, slug: input.slug, excerpt: input.excerpt,
      contentMarkdown: input.contentMarkdown, category: input.category,
      status: "draft", authorId: input.authorId, publishedAt: null,
      createdAt: now, updatedAt: now,
    });
  }
}

export async function setEditorialImage(target: EditorialTarget, id: string, storageKey: string, altText: string): Promise<void> {
  const db = getMySqlDb();
  const now = new Date();
  if (target === "homepage") {
    const [row] = await db.select().from(siteContent).where(and(eq(siteContent.id, id), eq(siteContent.contentKey, "homepage"))).limit(1);
    if (!row) throw new Error("Homepage content record was not found.");
    await db.update(siteContent).set({
      body: { ...(row.body ?? {}), hero_image_path: storageKey, hero_image_alt: altText, hero_image_rights_confirmed: false, hero_image_rights_evidence: "" },
      updatedAt: now,
    }).where(eq(siteContent.id, id));
  } else if (target === "collection") {
    const [row] = await db.select({ id: collections.id }).from(collections).where(eq(collections.id, id)).limit(1);
    if (!row) throw new Error("Collection was not found.");
    await db.update(collections).set({
      heroImagePath: storageKey, heroImageAlt: altText, heroImageRightsConfirmed: false,
      heroImageRightsEvidence: "", updatedAt: now,
    }).where(eq(collections.id, id));
  } else if (target === "artisan") {
    const [row] = await db.select({ id: artisanProfiles.id }).from(artisanProfiles).where(eq(artisanProfiles.id, id)).limit(1);
    if (!row) throw new Error("Maker profile was not found.");
    await db.update(artisanProfiles).set({
      portraitPath: storageKey, portraitAltText: altText, portraitRightsConfirmed: false,
      portraitRightsEvidence: "", updatedAt: now,
    }).where(eq(artisanProfiles.id, id));
  } else {
    const [row] = await db.select({ id: journalPosts.id }).from(journalPosts).where(eq(journalPosts.id, id)).limit(1);
    if (!row) throw new Error("Journal story was not found.");
    await db.update(journalPosts).set({
      coverImagePath: storageKey, coverImageAlt: altText, coverImageRightsConfirmed: false,
      coverImageRightsEvidence: "", updatedAt: now,
    }).where(eq(journalPosts.id, id));
  }
}

export async function confirmEditorialImageRights(target: EditorialTarget, id: string, evidence: string): Promise<void> {
  const db = getMySqlDb();
  const now = new Date();
  if (target === "homepage") {
    const [row] = await db.select().from(siteContent).where(and(eq(siteContent.id, id), eq(siteContent.contentKey, "homepage"))).limit(1);
    if (!row || typeof row.body.hero_image_path !== "string" || !row.body.hero_image_path) {
      throw new Error("Upload a homepage image before confirming its rights.");
    }
    await db.update(siteContent).set({
      body: { ...row.body, hero_image_rights_confirmed: true, hero_image_rights_evidence: evidence },
      updatedAt: now,
    }).where(eq(siteContent.id, id));
  } else if (target === "collection") {
    const current = await getCollection(id);
    if (!current?.hero_image_path) throw new Error("Upload a collection image before confirming its rights.");
    await db.update(collections).set({ heroImageRightsConfirmed: true, heroImageRightsEvidence: evidence, updatedAt: now }).where(eq(collections.id, id));
  } else if (target === "artisan") {
    const current = await getArtisanProfile(id);
    if (!current?.portrait_path) throw new Error("Upload a maker portrait before confirming its rights.");
    await db.update(artisanProfiles).set({ portraitRightsConfirmed: true, portraitRightsEvidence: evidence, updatedAt: now }).where(eq(artisanProfiles.id, id));
  } else {
    const current = await getJournalPost(id);
    if (!current?.cover_image_path) throw new Error("Upload a journal cover before confirming its rights.");
    await db.update(journalPosts).set({ coverImageRightsConfirmed: true, coverImageRightsEvidence: evidence, updatedAt: now }).where(eq(journalPosts.id, id));
  }
}

export async function getEditorialWorkspace() {
  const [home, collectionRows, artisanRows, journalRows] = await Promise.all([
    getHomepageRecord(), listCollections(), listArtisanProfiles(), listJournalPosts(),
  ]);
  return {
    home,
    collections: collectionRows,
    artisans: artisanRows,
    journal: journalRows,
  };
}

export async function isPublicEditorialMedia(storageKey: string): Promise<boolean> {
  const db = getMySqlDb();
  const [home, collection, artisan, journal] = await Promise.all([
    db.select({ body: siteContent.body }).from(siteContent).where(and(eq(siteContent.contentKey, "homepage"), eq(siteContent.isPublished, true))).limit(1),
    db.select({ id: collections.id }).from(collections).where(and(
      eq(collections.heroImagePath, storageKey), eq(collections.heroImageRightsConfirmed, true),
      eq(collections.isPublished, true),
    )).limit(1),
    db.select({ id: artisanProfiles.id }).from(artisanProfiles).where(and(
      eq(artisanProfiles.portraitPath, storageKey), eq(artisanProfiles.portraitRightsConfirmed, true),
      eq(artisanProfiles.isPublished, true),
    )).limit(1),
    db.select({ id: journalPosts.id }).from(journalPosts).where(and(
      eq(journalPosts.coverImagePath, storageKey), eq(journalPosts.coverImageRightsConfirmed, true),
      eq(journalPosts.status, "published"), isNotNull(journalPosts.publishedAt),
    )).limit(1),
  ]);
  const body = home[0]?.body;
  const isHomepageMedia = body && body.hero_image_path === storageKey &&
    body.hero_image_rights_confirmed === true &&
    typeof body.hero_image_alt === "string" && body.hero_image_alt.trim().length > 0 &&
    typeof body.hero_image_rights_evidence === "string" && body.hero_image_rights_evidence.trim().length > 0;
  if (isHomepageMedia) return true;
  const [collectionRow] = collection;
  const [artisanRow] = artisan;
  const [journalRow] = journal;
  if (collectionRow || artisanRow || journalRow) return true;
  return false;
}

export async function getPublishedMediaReferences() {
  const db = getMySqlDb();
  const [home, collectionRows, artisanRows, journalRows] = await Promise.all([
    db.select({ body: siteContent.body }).from(siteContent).where(and(eq(siteContent.contentKey, "homepage"), eq(siteContent.isPublished, true))).limit(1),
    db.select({ heroImagePath: collections.heroImagePath, heroImageRightsConfirmed: collections.heroImageRightsConfirmed, heroImageAlt: collections.heroImageAlt, heroImageRightsEvidence: collections.heroImageRightsEvidence }).from(collections).where(eq(collections.isPublished, true)),
    db.select({ portraitPath: artisanProfiles.portraitPath, portraitRightsConfirmed: artisanProfiles.portraitRightsConfirmed, portraitAltText: artisanProfiles.portraitAltText, portraitRightsEvidence: artisanProfiles.portraitRightsEvidence }).from(artisanProfiles).where(eq(artisanProfiles.isPublished, true)),
    db.select({ coverImagePath: journalPosts.coverImagePath, coverImageRightsConfirmed: journalPosts.coverImageRightsConfirmed, coverImageAlt: journalPosts.coverImageAlt, coverImageRightsEvidence: journalPosts.coverImageRightsEvidence }).from(journalPosts).where(and(eq(journalPosts.status, "published"), isNotNull(journalPosts.publishedAt))),
  ]);
  const keys: string[] = [];
  const body = home[0]?.body;
  if (body && typeof body.hero_image_path === "string" && body.hero_image_rights_confirmed === true &&
      typeof body.hero_image_alt === "string" && body.hero_image_alt.trim() &&
      typeof body.hero_image_rights_evidence === "string" && body.hero_image_rights_evidence.trim()) {
    keys.push(body.hero_image_path);
  }
  for (const row of collectionRows) {
    if (row.heroImagePath && row.heroImageRightsConfirmed && row.heroImageAlt.trim() && row.heroImageRightsEvidence.trim()) keys.push(row.heroImagePath);
  }
  for (const row of artisanRows) {
    if (row.portraitPath && row.portraitRightsConfirmed && row.portraitAltText.trim() && row.portraitRightsEvidence.trim()) keys.push(row.portraitPath);
  }
  for (const row of journalRows) {
    if (row.coverImagePath && row.coverImageRightsConfirmed && row.coverImageAlt.trim() && row.coverImageRightsEvidence.trim()) keys.push(row.coverImagePath);
  }
  return [...new Set(keys)];
}
