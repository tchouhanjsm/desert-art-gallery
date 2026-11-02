import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type JournalPost = {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  content_markdown: string;
  cover_image_path: string | null;
  cover_image_alt: string;
  cover_image_rights_confirmed: boolean;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { title: "Journal story" };
  const { data } = await supabase.from("journal_posts").select("title,excerpt").eq("slug", slug).eq("status", "published").maybeSingle();
  return data ? { title: data.title, description: data.excerpt } : {};
}

export default async function JournalArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();

  const { data, error } = await supabase.from("journal_posts")
    .select("title,slug,excerpt,category,content_markdown,cover_image_path,cover_image_alt,cover_image_rights_confirmed")
    .eq("slug", slug).eq("status", "published").not("published_at", "is", null).maybeSingle();
  if (error || !data) notFound();

  const post = data as unknown as JournalPost;
  let cover: string | null = null;
  if (post.cover_image_path && post.cover_image_rights_confirmed) {
    const { data: signed } = await supabase.storage.from("product-media").createSignedUrl(post.cover_image_path, 900);
    cover = signed?.signedUrl ?? null;
  }
  const paragraphs = post.content_markdown.split("\n\n").map((block) => block.trim()).filter(Boolean);

  return <article className="page-shell">
    <div className="breadcrumb"><Link href="/journal">JOURNAL</Link> / {post.category.toUpperCase()}</div>
    <div className="page-heading"><div className="section-kicker">{post.category}</div><h1>{post.title}</h1><p>{post.excerpt}</p></div>
    {cover && <div className="journal-article-cover"><Image src={cover} alt={post.cover_image_alt?.trim() || post.title} fill sizes="100vw" unoptimized /></div>}
    <div className="journal-body">{paragraphs.map((block, index) => {
      if (block.startsWith("## ")) return <h2 key={index}>{block.slice(3)}</h2>;
      if (block.startsWith("### ")) return <h3 key={index}>{block.slice(4)}</h3>;
      return <p key={index}>{block}</p>;
    })}</div>
    <div className="center-action"><Link href="/journal" className="text-link">BACK TO JOURNAL ↗</Link></div>
  </article>;
}
