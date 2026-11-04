import Image from "next/image";
import { galleryBlurDataUrl } from "@/lib/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasMySqlDatabase } from "@/server/db";
import { getPublishedJournalPost, type JournalRecord } from "@/server/editorial/repository";
import { getEditorialMediaUrl } from "@/server/media/storage";

async function getPost(slug: string): Promise<JournalRecord | null> {
  if (hasMySqlDatabase()) return getPublishedJournalPost(slug);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("journal_posts")
    .select("id,title,slug,excerpt,content_markdown,category,cover_image_path,cover_image_alt,cover_image_rights_confirmed,cover_image_rights_evidence,status,author_id,published_at")
    .eq("slug", slug).eq("status", "published").not("published_at", "is", null).maybeSingle();
  if (error || !data) return null;
  return data as unknown as JournalRecord;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  return post ? { title: post.title, description: post.excerpt } : {};
}

export default async function JournalArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  let cover: string | null = null;
  if (post.cover_image_path && post.cover_image_rights_confirmed &&
    post.cover_image_rights_evidence.trim() && post.cover_image_alt.trim()) {
    if (hasMySqlDatabase()) {
      cover = getEditorialMediaUrl(post.cover_image_path);
    } else {
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const { data: signed } = await supabase.storage.from("product-media").createSignedUrl(post.cover_image_path, 900);
        cover = signed?.signedUrl ?? null;
      }
    }
  }

  const paragraphs = post.content_markdown.split("\n\n").map((block) => block.trim()).filter(Boolean);

  return <article className="page-shell">
    <div className="breadcrumb"><Link href="/journal">JOURNAL</Link> / {post.category.toUpperCase()}</div>
    <div className="page-heading"><div className="section-kicker">{post.category}</div><h1>{post.title}</h1><p>{post.excerpt}</p></div>
    {cover && <div className="journal-article-cover"><Image placeholder="blur" blurDataURL={galleryBlurDataUrl} src={cover} alt={post.cover_image_alt?.trim() || post.title} fill sizes="100vw" /></div>}
    <div className="journal-body">{paragraphs.map((block, index) => {
      if (block.startsWith("## ")) return <h2 key={index}>{block.slice(3)}</h2>;
      if (block.startsWith("### ")) return <h3 key={index}>{block.slice(4)}</h3>;
      return <p key={index}>{block}</p>;
    })}</div>
    <div className="center-action"><Link href="/journal" className="text-link">BACK TO JOURNAL</Link></div>
  </article>;
}
