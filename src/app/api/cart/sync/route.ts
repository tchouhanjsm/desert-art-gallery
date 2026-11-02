import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gt, inArray } from "drizzle-orm";
import { cartLineKey, combineCartLines, normalizeCartLines, shouldMergeSavedCart } from "@/lib/cart";
import { capPurchasableQuantity } from "@/lib/variants";
import { isSameOriginRequest } from "@/lib/request-security";
import { getCurrentUser } from "@/server/auth/session";
import { getMySqlDb } from "@/server/db";
import { cartItems, inventoryReservationItems, inventoryReservations, products, productVariants } from "@/server/db/schema";

export const dynamic="force-dynamic";

export async function POST(request:NextRequest){
 if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin request rejected."},{status:403,headers:{"Cache-Control":"no-store"}});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid cart request."},{status:400});}
 const payload=body&&typeof body==="object"?body as {lines?:unknown;syncedUserId?:unknown}:{};
 const guest=normalizeCartLines(payload.lines);
 const user=await getCurrentUser();
 if(!user)return NextResponse.json({authenticated:false,lines:guest},{headers:{"Cache-Control":"no-store"}});
 const db=getMySqlDb();
 const savedRows=await db.select({
  slug:products.slug,productId:cartItems.productId,variantId:cartItems.variantId,quantity:cartItems.quantity,
 }).from(cartItems).innerJoin(products,eq(products.id,cartItems.productId)).where(eq(cartItems.userId,user.id));
 const saved=savedRows.map(row=>({slug:row.slug,...(row.variantId?{variantId:row.variantId}:{}),quantity:row.quantity}));
 const requested=combineCartLines(saved,guest,shouldMergeSavedCart(payload.syncedUserId,user.id));
 const slugs=[...new Set(requested.map(line=>line.slug))];
 if(!slugs.length){
  await db.delete(cartItems).where(eq(cartItems.userId,user.id));
  return NextResponse.json({authenticated:true,userId:user.id,lines:[]},{headers:{"Cache-Control":"no-store"}});
 }
 const productRows=await db.select().from(products).where(and(inArray(products.slug,slugs),eq(products.status,"active")));
 const bySlug=new Map(productRows.map(row=>[row.slug,row]));
 const productIds=productRows.map(row=>row.id);
 const variantRows=productIds.length?await db.select().from(productVariants)
  .where(and(inArray(productVariants.productId,productIds),eq(productVariants.status,"active"))):[];
 const variantsByProduct=new Map<string,typeof variantRows>();
 for(const row of variantRows)variantsByProduct.set(row.productId,[...(variantsByProduct.get(row.productId)??[]),row]);
 const holdRows=productIds.length?await db.select({
  productId:inventoryReservationItems.productId,variantId:inventoryReservationItems.variantId,quantity:inventoryReservationItems.quantity,
 }).from(inventoryReservationItems).innerJoin(inventoryReservations,eq(inventoryReservations.id,inventoryReservationItems.reservationId))
 .where(and(inArray(inventoryReservationItems.productId,productIds),eq(inventoryReservations.status,"reserved"),gt(inventoryReservations.expiresAt,new Date()))):[];
 const holds=new Map<string,number>();for(const row of holdRows){const key=row.productId+"::"+(row.variantId??"");holds.set(key,(holds.get(key)??0)+row.quantity);}
 const valid:{productId:string;variantId:string|null;quantity:number}[]=[];
 for(const line of requested.slice(0,30)){
  const product=bySlug.get(line.slug);if(!product)continue;
  const active=variantsByProduct.get(product.id)??[];
  const selected=line.variantId?active.find(v=>v.id===line.variantId):undefined;
  if(active.length&&!selected)continue;if(line.variantId&&!selected)continue;
  const key=product.id+"::"+(selected?.id??"");
  const available=capPurchasableQuantity((selected?.quantityOnHand??product.quantityOnHand)-(holds.get(key)??0),product.isOneOfAKind);
  const quantity=Math.min(line.quantity,available);if(quantity<1)continue;
  valid.push({productId:product.id,variantId:selected?.id??null,quantity});
 }
 await db.transaction(async tx=>{
  await tx.delete(cartItems).where(eq(cartItems.userId,user.id));
  if(valid.length)await tx.insert(cartItems).values(valid.map(line=>({
   id:crypto.randomUUID(),userId:user.id,productId:line.productId,variantId:line.variantId,
   quantity:line.quantity,createdAt:new Date(),updatedAt:new Date(),
  })));
 });
 const slugById=new Map(productRows.map(row=>[row.id,row.slug]));
 const lines=valid.flatMap(row=>slugById.get(row.productId)?[{slug:slugById.get(row.productId) as string,...(row.variantId?{variantId:row.variantId}:{}),quantity:row.quantity}]:[]);
 return NextResponse.json({authenticated:true,userId:user.id,lines},{headers:{"Cache-Control":"no-store"}});
}
