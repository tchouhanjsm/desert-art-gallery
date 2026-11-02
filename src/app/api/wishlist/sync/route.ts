import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { normalizeWishlistSlugs } from "@/lib/wishlist";
import { isSameOriginRequest } from "@/lib/request-security";
import { getCurrentUser } from "@/server/auth/session";
import { getMySqlDb } from "@/server/db";
import { products, wishlistItems } from "@/server/db/schema";

export const dynamic="force-dynamic";

export async function POST(request:NextRequest){
 if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin request rejected."},{status:403,headers:{"Cache-Control":"no-store"}});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid wishlist request."},{status:400});}
 const local=normalizeWishlistSlugs(body&&typeof body==="object"?(body as {slugs?:unknown}).slugs:undefined);
 const user=await getCurrentUser();if(!user)return NextResponse.json({authenticated:false,slugs:local},{headers:{"Cache-Control":"no-store"}});
 const db=getMySqlDb();
 const saved=await db.select({slug:products.slug}).from(wishlistItems).innerJoin(products,eq(products.id,wishlistItems.productId)).where(eq(wishlistItems.userId,user.id));
 const slugs=[...new Set([...saved.map(row=>row.slug),...local])].slice(0,100);
 const productRows=slugs.length?await db.select({id:products.id,slug:products.slug}).from(products).where(and(inArray(products.slug,slugs),eq(products.status,"active"))):[];
 await db.transaction(async tx=>{
  await tx.delete(wishlistItems).where(eq(wishlistItems.userId,user.id));
  if(productRows.length)await tx.insert(wishlistItems).values(productRows.map(row=>({userId:user.id,productId:row.id,createdAt:new Date()})));
 });
 return NextResponse.json({authenticated:true,slugs:productRows.map(row=>row.slug)},{headers:{"Cache-Control":"no-store"}});
}
