import Image from "next/image";
import { galleryBlurDataUrl } from "@/lib/image";
import Link from "next/link";
import { StorefrontPageHeading } from "@/components/StorefrontPageHeading";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasMySqlDatabase } from "@/server/db";
import { getPublishedArtisanProfiles, type ArtisanRecord } from "@/server/editorial/repository";
import { getEditorialMediaUrl } from "@/server/media/storage";

export const metadata = {
  title: "Meet the makers",
  description: "We share maker information only after the people featured have reviewed and approved it.",
};

type ArtisanCard = ArtisanRecord & { portrait: string | null };

export default async function ArtisansPage() {
  let cards: ArtisanCard[] = [];

  if (hasMySqlDatabase()) {
    const rows = await getPublishedArtisanProfiles();
    cards = rows.map((artisan) => ({
      ...artisan,
      portrait: artisan.portrait_path && artisan.portrait_rights_confirmed &&
        artisan.portrait_rights_evidence.trim() && artisan.portrait_alt_text.trim()
        ? getEditorialMediaUrl(artisan.portrait_path)
        : null,
    }));
  } else {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return (
        <div className="page-shell">
          <StorefrontPageHeading
            eyebrow="MAKERS & CRAFT"
            title="Meet the makers"
            description="We publish only words and details provided or approved by the makers themselves."
            className="page-heading"
          />
          <div className="info-copy">
            <p>Profiles appear here only after the people featured have reviewed and approved them. Names, photographs, biographies and experience details are never published without permission.</p>
            <p>Contact the gallery with questions about a piece or how it was made.</p>
            <Link className="contact-link" href="/contact">Contact us</Link>
          </div>
        </div>
      );
    }

    const { data, error } = await supabase.from("artisan_profiles")
      .select("id,full_name,role_title,short_bio,biography,craft_specialties,years_experience,portrait_path,portrait_alt_text,portrait_rights_confirmed,portrait_rights_evidence,sort_order,is_published")
      .eq("is_published", true).order("sort_order", { ascending: true });
    if (error) throw new Error("Maker information could not be loaded.");

    const rows = (data ?? []) as unknown as ArtisanRecord[];
    cards = await Promise.all(rows.map(async (artisan) => {
      let portrait: string | null = null;
      if (artisan.portrait_path && artisan.portrait_rights_confirmed && artisan.portrait_rights_evidence.trim() && artisan.portrait_alt_text.trim()) {
        const { data: signed } = await supabase.storage.from("product-media").createSignedUrl(artisan.portrait_path, 900);
        portrait = signed?.signedUrl ?? null;
      }
      return { ...artisan, portrait };
    }));
  }

  return (
    <div className="page-shell">
      <StorefrontPageHeading
        eyebrow="MAKERS & CRAFT"
        title="Maker stories"
        description="We feature only profiles and photographs reviewed and approved by the makers themselves."
        className="page-heading"
      />
      {cards.length ? (
        <div className="artisan-grid">
          {cards.map((artisan) => (
            <article className="artisan-card" key={artisan.id}>
              {artisan.portrait ? (
                <div className="artisan-photo">
                  <Image placeholder="blur" blurDataURL={galleryBlurDataUrl} src={artisan.portrait} alt={artisan.portrait_alt_text?.trim() || `Portrait of ${artisan.full_name}`} fill sizes="(max-width:700px) 88vw, 30vw" />
                </div>
              ) : (
                <div className="artisan-photo artisan-photo-empty" aria-hidden="true">Portrait not yet published</div>
              )}
              <div className="section-kicker">{artisan.role_title}</div>
              <h2>{artisan.full_name}</h2>
              {artisan.short_bio && <p>{artisan.short_bio}</p>}
              {artisan.biography && <p className="artisan-biography">{artisan.biography}</p>}
              {artisan.years_experience !== null && <small>{artisan.years_experience} years of experience</small>}
              {!!artisan.craft_specialties.length && (
                <div className="artisan-specialties">
                  {artisan.craft_specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-note">There are currently no maker profiles approved for publication.</div>
      )}
    </div>
  );
}
