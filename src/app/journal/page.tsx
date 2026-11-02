import Image from "next/image";
import Link from "next/link";
import { getPublishedJournalPosts, type JournalRecord } from "@/server/editorial/repository";
import { getMediaUrl } from "@/server/media/storage";

export const metadata={title:"Journal & Stories",description:"Stories about heritage textiles, craft and the creative spirit of Rajasthan."};
type JournalCard=JournalRecord&{cover:string|null};
export default async function JournalPage(){
 const rows=await getPublishedJournalPosts();
 const cards:JournalCard[]=rows.map(post=>({...post,cover:post.cover_image_path&&post.cover_image_rights_confirmed&&post.cover_image_rights_evidence.trim()&&post.cover_image_alt.trim()?getMediaUrl(post.cover_image_path):null}));
 return <div className="page-shell">
  <div className="page-heading"><div className="section-kicker">NOTES FROM THE DESERT</div><h1>Journal & stories</h1><p>Perspectives on textiles, craft and the culture that shapes them.</p></div>
  {cards.length?<div className="journal-grid">{cards.map(post=><article className="journal-card" key={post.id}><Link href={"/journal/"+post.slug}>
   {post.cover?<div className="journal-photo"><Image src={post.cover} alt={post.cover_image_alt.trim()||post.title} fill sizes="(max-width:700px) 88vw, 30vw" unoptimized/></div>:<div className="journal-photo journal-photo-empty" aria-hidden="true">DESERT ART GALLERY</div>}
   <div className="section-kicker">{post.category}</div><h2>{post.title}</h2><p>{post.excerpt}</p><span className="text-link">READ THE STORY ↗</span>
  </Link></article>)}</div>:<div className="empty-note">No stories have been published yet. Please visit again soon.</div>}
 </div>;
}
