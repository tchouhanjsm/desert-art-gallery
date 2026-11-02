"use server";
import { revalidatePath } from "next/cache";
import { hasSupportedImageSignature } from "@/lib/image-signature";
import { requireAdmin } from "@/server/auth/session";
import {
 confirmEditorialImageRights as confirmMySqlEditorialImageRights, getHomepageRecord,
 replaceCollectionProductSlugs, saveArtisanRecord, saveCollectionRecord,
 saveHomepageRecord, saveJournalRecord, setEditorialImage,
} from "@/server/editorial/repository";
import { createEditorialStorageKey, removeMedia, storeMedia, type EditorialImageMime, type EditorialTarget } from "@/server/media/storage";

function field(formData:FormData,key:string,max=2000){const raw=formData.get(key);if(typeof raw!=="string")return "";const value=raw.trim();if(value.length>max)throw new Error(key+" is too long.");return value;}
function checked(formData:FormData,key:string){return formData.get(key)==="yes";}
function slugify(value:string){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100);}
function requiredSlug(formData:FormData,title:string){const slug=slugify(field(formData,"slug",120)||title);if(!slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error("Enter a valid URL slug.");return slug;}
function sortOrder(formData:FormData){const raw=field(formData,"sort_order",8)||"0";if(!/^(0|[1-9]\d{0,3})$/.test(raw))throw new Error("Display order must be between 0 and 9999.");return Number(raw);}
function splitList(value:string){return [...new Set(value.split(",").map(item=>item.trim()).filter(Boolean))].slice(0,30);}
function revalidateEditorial(){for(const path of ["/","/shop","/artisans","/journal","/admin","/admin/content","/admin/media"])revalidatePath(path);revalidatePath("/collections/[slug]","page");revalidatePath("/journal/[slug]","page");}

export async function saveHomepageContent(formData:FormData){
 const user=await requireAdmin();
 const values={eyebrow:field(formData,"eyebrow",120),line_one:field(formData,"line_one",120),accent_one:field(formData,"accent_one",80),line_two:field(formData,"line_two",120),accent_two:field(formData,"accent_two",80),description:field(formData,"description",600),primary_cta_label:field(formData,"primary_cta_label",80),secondary_cta_label:field(formData,"secondary_cta_label",80)};
 if(!values.line_one||!values.accent_one||!values.line_two||!values.accent_two||!values.description)throw new Error("Complete both headline lines, their accent words and the description.");
 const existing=await getHomepageRecord();const body:Record<string,unknown>={...(existing?.body??{}),...values};const published=checked(formData,"is_published");
 if(published&&typeof body.hero_image_path==="string"&&body.hero_image_path&&(body.hero_image_rights_confirmed!==true||typeof body.hero_image_rights_evidence!=="string"||!body.hero_image_rights_evidence.trim()||typeof body.hero_image_alt!=="string"||!body.hero_image_alt.trim()))throw new Error("Confirm usage rights and provide descriptive alt text before publishing the homepage image.");
 await saveHomepageRecord(body,published,user.id);revalidateEditorial();
}
export async function saveCollectionProducts(formData:FormData){
 await requireAdmin();const id=field(formData,"collection_id",80);if(!id)throw new Error("Choose a collection first.");
 const values=formData.getAll("product_slugs");if(values.length>200||values.some(v=>typeof v!=="string"))throw new Error("Choose no more than 200 products.");
 await replaceCollectionProductSlugs(id,values.map(String));revalidateEditorial();
}
export async function saveCollection(formData:FormData){
 await requireAdmin();const id=field(formData,"id",80);const name=field(formData,"name",120);const slug=requiredSlug(formData,name);const description=field(formData,"description",1200);
 if(name.length<2||!description)throw new Error("Enter a collection name and description.");
 await saveCollectionRecord({id:id||undefined,name,slug,description,sortOrder:sortOrder(formData),isPublished:checked(formData,"is_published")});revalidateEditorial();
}
export async function saveArtisanProfile(formData:FormData){
 await requireAdmin();const id=field(formData,"id",80);const fullName=field(formData,"full_name",160);const roleTitle=field(formData,"role_title",120);const shortBio=field(formData,"short_bio",360);const biography=field(formData,"biography",10000);const specialties=splitList(field(formData,"craft_specialties",1200));const exp=field(formData,"years_experience",3);const yearsExperience=exp?Number(exp):null;
 if(fullName.length<2)throw new Error("Enter the name approved for publication.");if(exp&&(!Number.isInteger(yearsExperience)||(yearsExperience as number)<0||(yearsExperience as number)>100))throw new Error("Years of experience must be between 0 and 100.");
 await saveArtisanRecord({id:id||undefined,fullName,roleTitle,shortBio,biography,specialties,yearsExperience,sortOrder:sortOrder(formData),isPublished:checked(formData,"is_published")});revalidateEditorial();
}
export async function saveJournalPost(formData:FormData){
 const user=await requireAdmin();const id=field(formData,"id",80);const title=field(formData,"title",180);const slug=requiredSlug(formData,title);const excerpt=field(formData,"excerpt",500);const contentMarkdown=field(formData,"content_markdown",30000);const category=field(formData,"category",100)||"Stories";const status=field(formData,"status",12)||"draft";
 if(title.length<3||excerpt.length<20||contentMarkdown.length<40)throw new Error("Add a title, a useful excerpt and complete story.");if(!["draft","published","archived"].includes(status))throw new Error("Choose a valid publication status.");
 await saveJournalRecord({id:id||undefined,title,slug,excerpt,contentMarkdown,category,status:status as "draft"|"published"|"archived",authorId:user.id});revalidateEditorial();
}
function mediaMime(file:File):EditorialImageMime{const m:Record<string,EditorialImageMime>={"image/jpeg":"image/jpeg","image/png":"image/png","image/webp":"image/webp","image/avif":"image/avif"};const result=m[file.type];if(!result)throw new Error("Use JPEG, PNG, WebP or AVIF.");return result;}
export async function uploadEditorialImage(formData:FormData){
 await requireAdmin();const target=field(formData,"target",20) as EditorialTarget;const id=field(formData,"id",80);const alt=field(formData,"alt_text",300);const file=formData.get("image");
 if(!["homepage","collection","artisan","journal"].includes(target)||!id||!(file instanceof File)||!file.size||!alt)throw new Error("Choose a valid content record, image and descriptive alt text.");
 if(file.size>12*1024*1024)throw new Error("Images must be 12 MB or smaller.");const mime=mediaMime(file);
 if(!hasSupportedImageSignature(mime,new Uint8Array(await file.slice(0,64).arrayBuffer())))throw new Error("Image signature does not match the selected file type.");
 const key=createEditorialStorageKey(target,id,mime);await storeMedia(key,new Uint8Array(await file.arrayBuffer()));
 try{await setEditorialImage(target,id,key,alt);}catch(error){await removeMedia(key).catch(()=>undefined);throw error;}
 revalidateEditorial();
}
export async function confirmEditorialImageRights(formData:FormData){
 await requireAdmin();const target=field(formData,"target",20) as EditorialTarget;const id=field(formData,"id",80);const evidence=field(formData,"rights_evidence",1000);
 if(!["homepage","collection","artisan","journal"].includes(target)||!id)throw new Error("Choose a valid content record.");
 if(evidence.length<12||!checked(formData,"confirm_rights"))throw new Error("Provide a meaningful rights reference and explicitly confirm authorization.");
 await confirmMySqlEditorialImageRights(target,id,evidence);revalidateEditorial();
}
