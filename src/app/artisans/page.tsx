import Image from "next/image";
import { galleryBlurDataUrl } from "@/lib/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasMySqlDatabase } from "@/server/db";
import { getPublishedArtisanProfiles, type ArtisanRecord } from "@/server/editorial/repository";
import { getEditorialMediaUrl } from "@/server/media/storage";

export const metadata = {
  title: "つくり手について",
  description: "掲載するご本人の確認と承諾を得たつくり手の情報をご紹介します。",
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
          <div className="page-heading">
            <div className="section-kicker">つくり手とものづくり</div>
            <h1>つくり手について</h1>
            <p>ご本人の言葉、またはご本人の承諾を得た内容のみを掲載します。</p>
          </div>
          <div className="info-copy">
            <p>このページでは、掲載対象となるご本人が内容を確認し、承諾したプロフィールのみをご紹介します。お名前、写真、経歴、経験に関する情報は、許可なく掲載しません。</p>
            <p>商品や制作背景についてのご質問は、ギャラリーまでお問い合わせください。</p>
            <Link className="contact-link" href="/contact">お問い合わせ</Link>
          </div>
        </div>
      );
    }

    const { data, error } = await supabase.from("artisan_profiles")
      .select("id,full_name,role_title,short_bio,biography,craft_specialties,years_experience,portrait_path,portrait_alt_text,portrait_rights_confirmed,portrait_rights_evidence,sort_order,is_published")
      .eq("is_published", true).order("sort_order", { ascending: true });
    if (error) throw new Error("つくり手の情報を読み込めませんでした。");

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
      <div className="page-heading">
        <div className="section-kicker">PEOPLE & PROCESS</div>
        <h1>Maker stories</h1>
        <p>掲載するご本人が内容と写真を確認し、承諾したプロフィールのみをご紹介します。</p>
      </div>
      {cards.length ? (
        <div className="artisan-grid">
          {cards.map((artisan) => (
            <article className="artisan-card" key={artisan.id}>
              {artisan.portrait ? (
                <div className="artisan-photo">
                  <Image placeholder="blur" blurDataURL={galleryBlurDataUrl} src={artisan.portrait} alt={artisan.portrait_alt_text?.trim() || ("Portrait of " + artisan.full_name)} fill sizes="(max-width:700px) 88vw, 30vw" />
                </div>
              ) : (
                <div className="artisan-photo artisan-photo-empty" aria-hidden="true">写真は未掲載です</div>
              )}
              <div className="section-kicker">{artisan.role_title}</div>
              <h2>{artisan.full_name}</h2>
              {artisan.short_bio && <p>{artisan.short_bio}</p>}
              {artisan.biography && <p className="artisan-biography">{artisan.biography}</p>}
              {artisan.years_experience !== null && <small>{artisan.years_experience}年の経験</small>}
              {!!artisan.craft_specialties.length && (
                <div className="artisan-specialties">
                  {artisan.craft_specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-note">現在、掲載承諾済みのプロフィールはありません。</div>
      )}
    </div>
  );
}
