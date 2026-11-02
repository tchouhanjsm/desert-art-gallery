import Image from "next/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Our makers",
  description: "Maker profiles shared by Desert Art Gallery only after the people featured have reviewed and approved their details.",
};

type ArtisanRow = {
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
};

export default async function ArtisansPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <div className="page-shell">
        <div className="page-heading">
          <div className="section-kicker">PEOPLE & PROCESS</div>
          <h1>Maker stories</h1>
          <p>Personal stories should be told by, or with the approval of, the people involved.</p>
        </div>
        <div className="info-copy">
          <p>This space is reserved for profiles that have been reviewed and approved by the people featured. No names, portraits, biographies or experience claims will be published here without their permission.</p>
          <p>For questions about the making or details of a particular piece, contact the gallery.</p>
          <Link className="contact-link" href="/contact">CONTACT THE GALLERY ↗</Link>
        </div>
      </div>
    );
  }

  const { data, error } = await supabase.from("artisan_profiles")
    .select("id,full_name,role_title,short_bio,biography,craft_specialties,years_experience,portrait_path,portrait_alt_text,portrait_rights_confirmed")
    .eq("is_published", true).order("sort_order", { ascending: true });
  if (error) throw new Error("Unable to load maker profiles.");

  const rows = (data ?? []) as unknown as ArtisanRow[];
  const cards = await Promise.all(rows.map(async (artisan) => {
    let portrait: string | null = null;
    if (artisan.portrait_path && artisan.portrait_rights_confirmed) {
      const { data: signed } = await supabase.storage.from("product-media").createSignedUrl(artisan.portrait_path, 900);
      portrait = signed?.signedUrl ?? null;
    }
    return { ...artisan, portrait };
  }));

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div className="section-kicker">PEOPLE & PROCESS</div>
        <h1>Maker stories</h1>
        <p>Profiles are shared only when the people featured have approved the details and imagery.</p>
      </div>
      {cards.length ? (
        <div className="artisan-grid">
          {cards.map((artisan) => (
            <article className="artisan-card" key={artisan.id}>
              {artisan.portrait ? (
                <div className="artisan-photo">
                  <Image src={artisan.portrait} alt={artisan.portrait_alt_text?.trim() || ("Portrait of " + artisan.full_name)} fill sizes="(max-width:700px) 88vw, 30vw" unoptimized />
                </div>
              ) : (
                <div className="artisan-photo artisan-photo-empty" aria-hidden="true">PORTRAIT NOT PUBLISHED</div>
              )}
              <div className="section-kicker">{artisan.role_title}</div>
              <h2>{artisan.full_name}</h2>
              {artisan.short_bio && <p>{artisan.short_bio}</p>}
              {artisan.biography && <p className="artisan-biography">{artisan.biography}</p>}
              {artisan.years_experience !== null && <small>{artisan.years_experience} YEARS OF EXPERIENCE</small>}
              {!!artisan.craft_specialties.length && (
                <div className="artisan-specialties">
                  {artisan.craft_specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-note">No maker profiles are currently approved for publication.</div>
      )}
    </div>
  );
}
