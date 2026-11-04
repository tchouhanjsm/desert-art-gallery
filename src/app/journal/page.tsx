import Image from "next/image";
import { galleryBlurDataUrl } from "@/lib/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasMySqlDatabase } from "@/server/db";
import { getPublishedJournalPosts, type JournalRecord } from "@/server/editorial/repository";
import { getEditorialMediaUrl } from "@/server/media/storage";

export const metadata = {
  title: "Journal & Stories",
  description: "Stories about heritage textiles, craft and the creative spirit of Rajasthan.",
};

type JournalCard = JournalRecord & { cover: string | null };

export default async function JournalPage() {
  let cards: JournalCard[] = [];

  if (hasMySqlDatabase()) {
    const rows = await getPublishedJournalPosts();
    cards = rows.map((post) => ({
      ...post,
      cover: post.cover_image_path && post.cover_image_rights_confirmed &&
        post.cover_image_rights_evidence.trim() && post.cover_image_alt.trim()
        ? getEditorialMediaUrl(post.cover_image_path)
        : null,
    }));
  } else {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return <div className="page-shell">
      <div className="page-heading"><div className="section-kicker">NOTES FROM THE DESERT</div><h1>Journal & stories</h1><p>Perspectives on textiles, craft and the culture that shapes them.</p></div>
      <div className="empty-note">Stories will appear here when the editorial workspace is connected and articles are approved for publication.</div>
    </div>;

    const { data, error } = await supabase.from("journal_posts")
      .select("id,title,slug,excerpt,content_markdown,category,cover_image_path,cover_image_alt,cover_image_rights_confirmed,cover_image_rights_evidence,status,author_id,published_at")
      .eq("status", "published").not("published_at", "is", null)
      .order("published_at", { ascending: false });
    if (error) throw new Error("Unable to load journal stories.");

    const rows = (data ?? []) as unknown as JournalRecord[];
    cards = await Promise.all(rows.map(async (post) => {
      let cover: string | null = null;
      if (post.cover_image_path && post.cover_image_rights_confirmed &&
        post.cover_image_rights_evidence.trim() && post.cover_image_alt.trim()) {
        const { data: signed } = await supabase.storage.from("product-media").createSignedUrl(post.cover_image_path, 900);
        cover = signed?.signedUrl ?? null;
      }
      return { ...post, cover };
    }));
  }

  return <div className="page-shell">
    <div className="page-heading"><div className="section-kicker">NOTES FROM THE DESERT</div><h1>Journal & stories</h1><p>Perspectives on textiles, craft and the culture that shapes them.</p></div>
    {cards.length ? <div className="journal-grid">{cards.map((post) => <article className="journal-card" key={post.id}>
      <Link href={"/journal/" + post.slug}>
        {post.cover ? <div className="journal-photo"><Image placeholder="blur" blurDataURL={galleryBlurDataUrl} src={post.cover} alt={post.cover_image_alt?.trim() || post.title} fill sizes="(max-width:700px) 88vw, 30vw" /></div> : <div className="journal-photo journal-photo-empty" aria-hidden="true">DESERT ART GALLERY</div>}
        <div className="section-kicker">{post.category}</div><h2>{post.title}</h2><p>{post.excerpt}</p><span className="text-link">Read the story</span>
      </Link>
    </article>)}</div> : <div className="empty-note">No stories have been published yet. Please visit again soon.</div>}
  </div>;
}
