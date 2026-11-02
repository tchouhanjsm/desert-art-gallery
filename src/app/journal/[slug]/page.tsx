import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedJournalPost } from "@/server/editorial/repository";
import { getMediaUrl } from "@/server/media/storage";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const post=await getPublishedJournalPost(slug);return post?{title:post.title,description:post.excerpt}:{};
}
export default async function JournalArticlePage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const post=await getPublishedJournalPost(slug);if(!post)notFound();
 const cover=post.cover_image_path&&post.cover_image_rights_confirmed&&post.cover_image_rights_evidence.trim()&&post.cover_image_alt.trim()?getMediaUrl(post.cover_image_path):null;
 const paragraphs=post.content_markdown.split("\n\n").map(block=>block.trim()).filter(Boolean);
 return <article className="page-shell">
  <div className="breadcrumb"><Link href="/journal">JOURNAL</Link> / {post.category.toUpperCase()}</div>
  <div className="page-heading"><div className="section-kicker">{post.category}</div><h1>{post.title}</h1><p>{post.excerpt}</p></div>
  {cover&&<div className="journal-article-cover"><Image src={cover} alt={post.cover_image_alt.trim()||post.title} fill sizes="100vw" unoptimized/></div>}
  <div className="journal-body">{paragraphs.map((block,index)=>block.startsWith("## ")?<h2 key={index}>{block.slice(3)}</h2>:block.startsWith("### ")?<h3 key={index}>{block.slice(4)}</h3>:<p key={index}>{block}</p>)}</div>
  <div className="center-action"><Link href="/journal" className="text-link">BACK TO JOURNAL ↗</Link></div>
 </article>;
}
