"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupportedImageSignature } from "@/lib/image-signature";
import { hasMySqlDatabase } from "@/server/db";
import {
  confirmEditorialImageRights as confirmMySqlEditorialImageRights,
  getHomepageRecord,
  saveArtisanRecord,
  saveCollectionRecord,
  saveHomepageRecord,
  saveJournalRecord,
  setEditorialImage,
  replaceCollectionProductSlugs,
} from "@/server/editorial/repository";
import {
  createEditorialStorageKey,
  removeEditorialMedia,
  storeEditorialMedia,
  type EditorialImageMime,
  type EditorialTarget,
} from "@/server/media/storage";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("The content workspace is not connected to its database.");

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Sign in with an administrator account.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !["admin", "owner"].includes(profile.role)) {
    throw new Error("Administrator permissions are required.");
  }
  return { supabase, userId: user.id };
}

function field(formData: FormData, key: string, maxLength = 2000) {
  const value = formData.get(key);
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(key + " is too long.");
  return trimmed;
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "yes";
}

function slugify(value: string) {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function requiredSlug(formData: FormData, title: string) {
  const slug = slugify(field(formData, "slug", 120) || title);
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Enter a valid URL slug using letters, numbers and hyphens.");
  }
  return slug;
}

function sortOrder(formData: FormData) {
  const value = field(formData, "sort_order", 8) || "0";
  if (!/^(0|[1-9]\d{0,3})$/.test(value)) throw new Error("Display order must be between 0 and 9999.");
  return Number(value);
}

function splitList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 30);
}

function revalidateEditorial() {
  for (const path of ["/", "/shop", "/artisans", "/journal", "/admin", "/admin/content", "/admin/media"]) {
    revalidatePath(path);
  }
  revalidatePath("/collections/[slug]", "page");
  revalidatePath("/journal/[slug]", "page");
}

export async function saveHomepageContent(formData: FormData) {
  const { supabase, userId } = await requireAdmin();
  const title = "Homepage";
  const values = {
    eyebrow: field(formData, "eyebrow", 120),
    line_one: field(formData, "line_one", 120),
    accent_one: field(formData, "accent_one", 80),
    line_two: field(formData, "line_two", 120),
    accent_two: field(formData, "accent_two", 80),
    description: field(formData, "description", 600),
    primary_cta_label: field(formData, "primary_cta_label", 80),
    secondary_cta_label: field(formData, "secondary_cta_label", 80),
  };
  if (!values.line_one || !values.accent_one || !values.line_two || !values.accent_two || !values.description) {
    throw new Error("Complete both headline lines, their accent words and the description.");
  }

  if (hasMySqlDatabase()) {
    const existing = await getHomepageRecord();
    const body: Record<string, unknown> = { ...(existing?.body ?? {}), ...values };
    const isPublished = checked(formData, "is_published");
    if (isPublished && typeof body.hero_image_path === "string" && body.hero_image_path &&
      (body.hero_image_rights_confirmed !== true ||
       typeof body.hero_image_rights_evidence !== "string" || !body.hero_image_rights_evidence.trim() ||
       typeof body.hero_image_alt !== "string" || !body.hero_image_alt.trim())) {
      throw new Error("Confirm usage rights and provide descriptive alt text before publishing the homepage image.");
    }
    await saveHomepageRecord(body, isPublished, userId);
    revalidateEditorial();
    return;
  }

  const { data: existing, error: readError } = await supabase
    .from("site_content")
    .select("id,body")
    .eq("content_key", "homepage")
    .maybeSingle();
  if (readError) throw new Error("Unable to read the current homepage content.");

  const oldBody = existing?.body && typeof existing.body === "object" && !Array.isArray(existing.body)
    ? existing.body as Record<string, unknown>
    : {};
  const body: Record<string, unknown> = { ...oldBody, ...values };
  const isPublished = checked(formData, "is_published");
  if (isPublished && typeof body.hero_image_path === "string" && body.hero_image_path && body.hero_image_rights_confirmed !== true) {
    throw new Error("Confirm usage rights for the homepage photograph before publishing it.");
  }

  const { error } = await supabase.from("site_content").upsert({
    content_key: "homepage",
    title,
    body,
    is_published: isPublished,
    updated_by: userId,
  }, { onConflict: "content_key" });
  if (error) throw new Error("Unable to save homepage content: " + error.message);
  revalidateEditorial();
}

export async function saveCollectionProducts(formData: FormData) {
  const { supabase } = await requireAdmin();
  if (!hasMySqlDatabase()) throw new Error("Product curation for MySQL collections is not enabled.");

  const collectionId = field(formData, "collection_id", 80);
  if (!collectionId) throw new Error("Choose a collection before assigning products.");
  const submitted = formData.getAll("product_slugs");
  if (submitted.length > 200 || submitted.some((value) => typeof value !== "string")) {
    throw new Error("Choose no more than 200 products for one collection.");
  }
  const slugs = [...new Set(submitted.map((value) => String(value).trim()).filter(Boolean))];
  if (slugs.some((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
    throw new Error("One or more selected product slugs are invalid.");
  }

  if (slugs.length) {
    const { data, error } = await supabase.from("products")
      .select("slug")
      .eq("status", "active")
      .in("slug", slugs);
    if (error) throw new Error("Unable to verify selected catalogue products.");
    const verified = new Set((data ?? []).map((row) => row.slug));
    if (verified.size !== slugs.length) {
      throw new Error("A selected product is no longer active. Refresh the page and review the collection assignments.");
    }
  }

  await replaceCollectionProductSlugs(collectionId, slugs);
  revalidateEditorial();
}

export async function saveCollection(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = field(formData, "id", 80);
  const name = field(formData, "name", 120);
  const slug = requiredSlug(formData, name);
  const description = field(formData, "description", 1200);
  if (name.length < 2) throw new Error("Collection name must contain at least two characters.");
  if (!description) throw new Error("Add a short collection description.");
  const isPublished = checked(formData, "is_published");

  if (hasMySqlDatabase()) {
    await saveCollectionRecord({ id: id || undefined, name, slug, description, sortOrder: sortOrder(formData), isPublished });
    revalidateEditorial();
    return;
  }

  if (id) {
    const { data: current, error: readError } = await supabase.from("collections")
      .select("hero_image_path,hero_image_rights_confirmed")
      .eq("id", id)
      .maybeSingle();
    if (readError || !current) throw new Error("Collection was not found.");
    if (isPublished && current.hero_image_path && !current.hero_image_rights_confirmed) {
      throw new Error("Confirm usage rights for the collection photograph before publishing.");
    }
    const { error } = await supabase.from("collections").update({
      name, slug, description, sort_order: sortOrder(formData), is_published: isPublished,
    }).eq("id", id);
    if (error) throw new Error("Unable to update collection: " + error.message);
  } else {
    const { error } = await supabase.from("collections").insert({
      name, slug, description, sort_order: sortOrder(formData), is_published: false,
    });
    if (error) throw new Error("Unable to create collection: " + error.message);
  }
  revalidateEditorial();
}

export async function saveArtisanProfile(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = field(formData, "id", 80);
  const fullName = field(formData, "full_name", 160);
  const roleTitle = field(formData, "role_title", 120);
  const shortBio = field(formData, "short_bio", 360);
  const biography = field(formData, "biography", 10000);
  const specialties = splitList(field(formData, "craft_specialties", 1200));
  const experienceText = field(formData, "years_experience", 3);
  const yearsExperience = experienceText ? Number(experienceText) : null;
  if (fullName.length < 2) throw new Error("Enter the name approved for publication.");
  if (experienceText && (!Number.isInteger(yearsExperience) || (yearsExperience as number) < 0 || (yearsExperience as number) > 100)) {
    throw new Error("Years of experience must be between 0 and 100.");
  }
  const isPublished = checked(formData, "is_published");
  const values = {
    full_name: fullName,
    role_title: roleTitle,
    short_bio: shortBio,
    biography,
    craft_specialties: specialties,
    years_experience: yearsExperience,
    sort_order: sortOrder(formData),
    is_published: isPublished,
  };

  if (hasMySqlDatabase()) {
    await saveArtisanRecord({
      id: id || undefined,
      fullName,
      roleTitle,
      shortBio,
      biography,
      specialties,
      yearsExperience,
      sortOrder: sortOrder(formData),
      isPublished,
    });
    revalidateEditorial();
    return;
  }

  if (id) {
    const { data: current, error: readError } = await supabase.from("artisan_profiles")
      .select("portrait_path,portrait_rights_confirmed")
      .eq("id", id).maybeSingle();
    if (readError || !current) throw new Error("Maker profile was not found.");
    if (isPublished && current.portrait_path && !current.portrait_rights_confirmed) {
      throw new Error("Confirm portrait usage rights before publishing this profile.");
    }
    const { error } = await supabase.from("artisan_profiles").update(values).eq("id", id);
    if (error) throw new Error("Unable to update maker profile: " + error.message);
  } else {
    if (isPublished) throw new Error("Save a new maker profile as a draft first. Review and publish it from the saved record.");
    const { error } = await supabase.from("artisan_profiles").insert(values);
    if (error) throw new Error("Unable to create maker profile: " + error.message);
  }
  revalidateEditorial();
}

export async function saveJournalPost(formData: FormData) {
  const { supabase, userId } = await requireAdmin();
  const id = field(formData, "id", 80);
  const title = field(formData, "title", 180);
  const slug = requiredSlug(formData, title);
  const excerpt = field(formData, "excerpt", 500);
  const content = field(formData, "content_markdown", 30000);
  const category = field(formData, "category", 100) || "Stories";
  const status = field(formData, "status", 12) || "draft";
  if (title.length < 3 || excerpt.length < 20 || content.length < 40) {
    throw new Error("Add a title, a useful excerpt and the complete story before saving.");
  }
  if (!["draft", "published", "archived"].includes(status)) throw new Error("Choose a valid publication status.");

  if (hasMySqlDatabase()) {
    await saveJournalRecord({
      id: id || undefined,
      title,
      slug,
      excerpt,
      contentMarkdown: content,
      category,
      status: status as "draft" | "published" | "archived",
      authorId: userId,
    });
    revalidateEditorial();
    return;
  }

  const values = { title, slug, excerpt, content_markdown: content, category, status };
  if (id) {
    const { data: current, error: readError } = await supabase.from("journal_posts")
      .select("cover_image_path,cover_image_rights_confirmed,published_at")
      .eq("id", id).maybeSingle();
    if (readError || !current) throw new Error("Journal story was not found.");
    if (status === "published" && current.cover_image_path && !current.cover_image_rights_confirmed) {
      throw new Error("Confirm usage rights for the cover photograph before publishing.");
    }
    const publishedAt = status === "published" ? current.published_at || new Date().toISOString() : null;
    const { error } = await supabase.from("journal_posts").update({ ...values, published_at: publishedAt }).eq("id", id);
    if (error) throw new Error("Unable to update journal story: " + error.message);
  } else {
    if (status !== "draft") throw new Error("New stories must be saved as drafts before publication.");
    const { error } = await supabase.from("journal_posts").insert({ ...values, author_id: userId, published_at: null });
    if (error) throw new Error("Unable to create journal story: " + error.message);
  }
  revalidateEditorial();
}

function imageType(file: File) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  const extension = extensions[file.type];
  if (!extension) throw new Error("Use a JPEG, PNG, WebP or AVIF image.");
  return extension;
}

export async function uploadEditorialImage(formData: FormData) {
  const { supabase } = await requireAdmin();
  const target = field(formData, "target", 20) as EditorialTarget;
  const id = field(formData, "id", 80);
  const altText = field(formData, "alt_text", 300);
  const file = formData.get("image");
  if (!["homepage", "collection", "artisan", "journal"].includes(target)) throw new Error("Choose a valid content destination.");
  if (!id || !(file instanceof File) || file.size === 0) throw new Error("Choose a content record and an image.");
  if (!altText) throw new Error("Descriptive image alt text is required.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Images must be 12 MB or smaller.");

  const extension = imageType(file);
  const signature = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  if (!hasSupportedImageSignature(file.type, signature)) throw new Error("The image contents do not match the selected file type.");

  if (hasMySqlDatabase()) {
    const storageKey = createEditorialStorageKey(target, id, file.type as EditorialImageMime);
    const bytes = new Uint8Array(await file.arrayBuffer());
    await storeEditorialMedia(storageKey, bytes);
    try {
      await setEditorialImage(target, id, storageKey, altText);
    } catch (error) {
      await removeEditorialMedia(storageKey).catch(() => undefined);
      throw error;
    }
    revalidateEditorial();
    return;
  }

  let homepageBody: Record<string, unknown> | null = null;
  if (target === "homepage") {
    const { data, error } = await supabase.from("site_content").select("id,body").eq("id", id).maybeSingle();
    if (error || !data) throw new Error("Homepage content record was not found.");
    homepageBody = data.body && typeof data.body === "object" && !Array.isArray(data.body)
      ? data.body as Record<string, unknown>
      : {};
  } else if (target === "collection") {
    const { data, error } = await supabase.from("collections").select("id").eq("id", id).maybeSingle();
    if (error || !data) throw new Error("Collection was not found.");
  } else if (target === "artisan") {
    const { data, error } = await supabase.from("artisan_profiles").select("id").eq("id", id).maybeSingle();
    if (error || !data) throw new Error("Maker profile was not found.");
  } else {
    const { data, error } = await supabase.from("journal_posts").select("id").eq("id", id).maybeSingle();
    if (error || !data) throw new Error("Journal story was not found.");
  }

  const path = "editorial/" + target + "/" + id + "/" + randomUUID() + "." + extension;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from("product-media").upload(path, bytes, {
    contentType: file.type, cacheControl: "3600", upsert: false,
  });
  if (uploadError) throw new Error("Image upload failed: " + uploadError.message);

  let updateError: { message: string } | null = null;
  if (target === "homepage") {
    if (!homepageBody) {
      updateError = { message: "Homepage content was not available for the image update." };
    } else {
      const { data, error } = await supabase.from("site_content").update({
        body: { ...homepageBody, hero_image_path: path, hero_image_alt: altText, hero_image_rights_confirmed: false, hero_image_rights_evidence: "" },
      }).eq("id", id).select("id").maybeSingle();
      updateError = error || (!data ? { message: "Homepage content was removed before the image update completed." } : null);
    }
  } else if (target === "collection") {
    const { data, error } = await supabase.from("collections").update({
      hero_image_path: path, hero_image_alt: altText, hero_image_rights_confirmed: false, hero_image_rights_evidence: "",
    }).eq("id", id).select("id").maybeSingle();
    updateError = error || (!data ? { message: "Collection was removed before the image update completed." } : null);
  } else if (target === "artisan") {
    const { data, error } = await supabase.from("artisan_profiles").update({
      portrait_path: path, portrait_alt_text: altText, portrait_rights_confirmed: false, portrait_rights_evidence: "",
    }).eq("id", id).select("id").maybeSingle();
    updateError = error || (!data ? { message: "Maker profile was removed before the image update completed." } : null);
  } else {
    const { data, error } = await supabase.from("journal_posts").update({
      cover_image_path: path, cover_image_alt: altText, cover_image_rights_confirmed: false, cover_image_rights_evidence: "",
    }).eq("id", id).select("id").maybeSingle();
    updateError = error || (!data ? { message: "Journal story was removed before the image update completed." } : null);
  }
  if (updateError) {
    await supabase.storage.from("product-media").remove([path]);
    throw new Error("Image metadata could not be saved: " + updateError.message);
  }
  revalidateEditorial();
}

export async function confirmEditorialImageRights(formData: FormData) {
  const { supabase } = await requireAdmin();
  const target = field(formData, "target", 20) as EditorialTarget;
  const id = field(formData, "id", 80);
  const evidence = field(formData, "rights_evidence", 1000);
  if (!["homepage", "collection", "artisan", "journal"].includes(target) || !id) throw new Error("Content target is invalid.");
  if (evidence.length < 12 || !checked(formData, "confirm_rights")) {
    throw new Error("Provide a meaningful usage-rights reference and explicitly confirm authorization.");
  }

  if (hasMySqlDatabase()) {
    await confirmMySqlEditorialImageRights(target, id, evidence);
    revalidateEditorial();
    return;
  }

  if (target === "homepage") {
    const { data, error: readError } = await supabase.from("site_content").select("body").eq("id", id).maybeSingle();
    if (readError || !data) throw new Error("Homepage content was not found.");
    const body = data.body && typeof data.body === "object" && !Array.isArray(data.body) ? data.body as Record<string, unknown> : {};
    if (typeof body.hero_image_path !== "string" || !body.hero_image_path) throw new Error("Upload a homepage image before confirming its rights.");
    const { error } = await supabase.from("site_content").update({
      body: { ...body, hero_image_rights_confirmed: true, hero_image_rights_evidence: evidence },
    }).eq("id", id);
    if (error) throw new Error("Unable to confirm homepage image rights: " + error.message);
  } else if (target === "collection") {
    const { data, error: readError } = await supabase.from("collections").select("hero_image_path").eq("id", id).maybeSingle();
    if (readError || !data?.hero_image_path) throw new Error("Upload a collection image before confirming its rights.");
    const { error } = await supabase.from("collections").update({ hero_image_rights_confirmed: true, hero_image_rights_evidence: evidence }).eq("id", id);
    if (error) throw new Error("Unable to confirm collection image rights: " + error.message);
  } else if (target === "artisan") {
    const { data, error: readError } = await supabase.from("artisan_profiles").select("portrait_path").eq("id", id).maybeSingle();
    if (readError || !data?.portrait_path) throw new Error("Upload a maker portrait before confirming its rights.");
    const { error } = await supabase.from("artisan_profiles").update({ portrait_rights_confirmed: true, portrait_rights_evidence: evidence }).eq("id", id);
    if (error) throw new Error("Unable to confirm portrait rights: " + error.message);
  } else {
    const { data, error: readError } = await supabase.from("journal_posts").select("cover_image_path").eq("id", id).maybeSingle();
    if (readError || !data?.cover_image_path) throw new Error("Upload a journal cover before confirming its rights.");
    const { error } = await supabase.from("journal_posts").update({ cover_image_rights_confirmed: true, cover_image_rights_evidence: evidence }).eq("id", id);
    if (error) throw new Error("Unable to confirm journal cover rights: " + error.message);
  }
  revalidateEditorial();
}
