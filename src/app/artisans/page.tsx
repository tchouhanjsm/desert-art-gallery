import Image from "next/image";
import Link from "next/link";
import { getPublishedArtisanProfiles, type ArtisanRecord } from "@/server/editorial/repository";
import { getMediaUrl } from "@/server/media/storage";

export const metadata = {
 title:"Our makers",
 description:"Maker profiles shared by Desert Art Gallery only after the people featured have reviewed and approved their details.",
};
type ArtisanCard=ArtisanRecord&{portrait:string|null};
export default async function ArtisansPage(){
 const rows=await getPublishedArtisanProfiles();
 const cards:ArtisanCard[]=rows.map(artisan=>({...artisan,portrait:artisan.portrait_path&&artisan.portrait_rights_confirmed&&artisan.portrait_rights_evidence.trim()&&artisan.portrait_alt_text.trim()?getMediaUrl(artisan.portrait_path):null}));
 return <div className="page-shell">
  <div className="page-heading"><div className="section-kicker">PEOPLE & PROCESS</div><h1>Maker stories</h1><p>Profiles are shared only when the people featured have approved the details and imagery.</p></div>
  {cards.length?<div className="artisan-grid">{cards.map(artisan=><article className="artisan-card" key={artisan.id}>
   {artisan.portrait?<div className="artisan-photo"><Image src={artisan.portrait} alt={artisan.portrait_alt_text.trim()||("Portrait of "+artisan.full_name)} fill sizes="(max-width:700px) 88vw, 30vw" unoptimized/></div>:<div className="artisan-photo artisan-photo-empty" aria-hidden="true">PORTRAIT NOT PUBLISHED</div>}
   <div className="section-kicker">{artisan.role_title}</div><h2>{artisan.full_name}</h2>
   {artisan.short_bio&&<p>{artisan.short_bio}</p>}{artisan.biography&&<p className="artisan-biography">{artisan.biography}</p>}
   {artisan.years_experience!==null&&<small>{artisan.years_experience} YEARS OF EXPERIENCE</small>}
   {!!artisan.craft_specialties.length&&<div className="artisan-specialties">{artisan.craft_specialties.map(s=><span key={s}>{s}</span>)}</div>}
  </article>)}</div>:<div className="empty-note">No maker profiles are currently approved for publication.</div>}
 </div>;
}
