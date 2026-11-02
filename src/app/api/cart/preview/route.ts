import { and, eq, gt, inArray } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/request-security";
import { normalizeCartLines } from "@/lib/cart";
import { capPurchasableQuantity, resolveVariantPriceMinor } from "@/lib/variants";
import { getPublishedProduct } from "@/server/catalogue/repository";
import { getMySqlDb } from "@/server/db";
import { inventoryReservationItems, inventoryReservations } from "@/server/db/schema";

export const dynamic="force-dynamic";

export async function POST(request:NextRequest){
 if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin request rejected."},{status:403});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid cart request."},{status:400});}
 const lines=normalizeCartLines(body&&typeof body==="object"?(body as {lines?:unknown}).lines:undefined);
 if(!lines.length)return NextResponse.json({items:[]},{headers:{"Cache-Control":"no-store"}});
 const products=await Promise.all(lines.map(line=>getPublishedProduct(line.slug)));
 const ids=products.flatMap(p=>p?[p.id]:[]);
 const activeHolds=ids.length?await getMySqlDb().select({
  productId:inventoryReservationItems.productId,variantId:inventoryReservationItems.variantId,quantity:inventoryReservationItems.quantity,
 }).from(inventoryReservationItems).innerJoin(inventoryReservations,eq(inventoryReservations.id,inventoryReservationItems.reservationId))
 .where(and(inArray(inventoryReservationItems.productId,ids),eq(inventoryReservations.status,"reserved"),gt(inventoryReservations.expiresAt,new Date()))):[];
 const holds=new Map<string,number>();
 for(const row of activeHolds){const k=row.productId+"::"+(row.variantId??"");holds.set(k,(holds.get(k)??0)+row.quantity);}
 const items=lines.map((line,index)=>{
  const product=products[index];
  if(!product)return {slug:line.slug,variantId:line.variantId??null,variantLabel:null,name:"This piece is no longer available",quantityRequested:line.quantity,availableQuantity:0,available:false,priceMinor:null,currency:null,image:null,imageAlt:""};
  const activeVariants=product.variants.filter(v=>v.status==="active");
  const selected=line.variantId?activeVariants.find(v=>v.id===line.variantId)??null:null;
  const invalid=activeVariants.length>0?!selected:Boolean(line.variantId&&!selected);
  const stock=selected?.quantityOnHand??(activeVariants.length===0?product.quantityOnHand:0);
  const available=capPurchasableQuantity(stock-(holds.get(product.id+"::"+(selected?.id??""))??0),product.isOneOfAKind);
  const price=selected?resolveVariantPriceMinor(selected.priceMinor,product.priceMinor):activeVariants.length===0&&!line.variantId?product.priceMinor:null;
  return {
   slug:product.slug,variantId:line.variantId??null,variantLabel:selected?.label??(invalid?"Select an option on the product page":null),
   name:product.name,quantityRequested:line.quantity,availableQuantity:available,
   available:!invalid&&available>=line.quantity&&price!==null,
   priceMinor:price,currency:price===null?null:product.currency,
   image:product.image||null,imageAlt:product.imageAlt||"",
  };
 });
 return NextResponse.json({items},{headers:{"Cache-Control":"no-store"}});
}
