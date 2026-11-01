import Image from "next/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Our Makers",
  description: "Meet the makers and craft specialists whose stories are shared by Desert Art Gallery with their permission.",
};

type ArtisanRow = {
  id: string;
  full_name: string;
  role_title: string;
  short_bio: string;
  craft_specialties: string[];
  years_experience: number | null;
  portrait_path: string | null;
  portrait_rights_confirmed: boolean;
};

export default async function ArtisansPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell">
    <div className="page-heading"><div className="section-kicker">THE HAND BEHIND THE WORK</div><h1>Meet our makers</h1><p>Craft is personal. Every story deserves to be told accurately.</p></div>
    <div className="info-copy"><p>Our work connects with tailors, embroiderers and village makers in and around the wider Thar region. Individual profiles will appear here after each person has reviewed and approved their story and portrait.</p><p>Contact us to ask about the making, materials and provenance of a particular textile.</p><Link className="contact-link" href="/contact">CONTACT THE GALLERY ↗</Link></div>
  </div>;

  const { data, error } = await supabase.from("artisan_profiles")
    .select("id,full_name,role_title,short_bio,craft_specialties,years_experience,portrait_path,portrait_rights_confirmed")
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

  return <div className="page-shell">
    <div className="page-heading"><div className="section-kicker">THE HAND BEHIND THE WORK</div><h1>Meet our makers</h1><p>Skilled hands, individual voices and traditions carried forward.</p></div>
    {cards.length ? <div className="artisan-grid">{cards.map((artisan) => <article className="artisan-card" key={artisan.id}>
      {artisan.portrait ? <div className="artisan-photo"><Image src={artisan.portrait} alt={"Portrait of " + artisan.full_name} fill sizes="(max-width:700px) 88vw, 30vw" unoptimized /></div> : <div className="artisan-photo artisan-photo-empty" aria-hidden="true">CRAFT & COMMUNITY</div>}
      <div className="section-kicker">{artisan.role_title}</div><h2>{artisan.full_name}</h2>
      {artisan.short_bio && <p>{artisan.short_bio}</p>}
      {artisan.years_experience !== null && <small>{artisan.years_experience} YEARS OF EXPERIENCE</small>}
      {!!artisan.craft_specialties.length && <div className="artisan-specialties">{artisan.craft_specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}</div>}
    </article>)}</div> : <div className="empty-note">Maker profiles will appear here after they have been reviewed and approved by the people featured.</div>}
  </div>;
}
