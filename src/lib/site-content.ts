import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PublishedHomepageContent = {
  eyebrow: string;
  lineOne: string;
  accentOne: string;
  lineTwo: string;
  accentTwo: string;
  description: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  heroImage: string | null;
  heroImageAlt: string;
};

function textValue(body: Record<string, unknown>, key: string, fallback: string) {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function getPublishedHomepageContent(): Promise<PublishedHomepageContent | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("site_content")
    .select("body,is_published")
    .eq("content_key", "homepage")
    .eq("is_published", true)
    .maybeSingle();

  if (error) throw new Error("Unable to load published homepage content.");
  if (!data) return null;

  const body = data.body && typeof data.body === "object" && !Array.isArray(data.body)
    ? data.body as Record<string, unknown>
    : {};

  let heroImage: string | null = null;
  const path = typeof body.hero_image_path === "string" ? body.hero_image_path : "";
  const rightsConfirmed = body.hero_image_rights_confirmed === true;
  const alt = textValue(body, "hero_image_alt", "Desert Art Gallery homepage photograph");
  if (path && rightsConfirmed && alt) {
    const { data: signed } = await supabase.storage.from("product-media").createSignedUrl(path, 60 * 60);
    heroImage = signed?.signedUrl ?? null;
  }

  return {
    eyebrow: textValue(body, "eyebrow", "A CURATED GALLERY · JAISALMER, RAJASTHAN"),
    lineOne: textValue(body, "line_one", "Objects with"),
    accentOne: textValue(body, "accent_one", "stories."),
    lineTwo: textValue(body, "line_two", "Textiles with"),
    accentTwo: textValue(body, "accent_two", "character."),
    description: textValue(body, "description", "Discover a considered collection of textiles and objects, presented with the detail and context each piece deserves."),
    primaryCtaLabel: textValue(body, "primary_cta_label", "Explore the collection"),
    secondaryCtaLabel: textValue(body, "secondary_cta_label", "Our story"),
    heroImage,
    heroImageAlt: alt,
  };
}
