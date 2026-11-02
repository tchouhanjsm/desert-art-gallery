import { createHash, randomUUID } from "node:crypto";
import { and, eq, gt, inArray } from "drizzle-orm";
import { normalizeCartLines, type CartLine } from "@/lib/cart";
import { capPurchasableQuantity, resolveVariantPriceMinor } from "@/lib/variants";
import { getMySqlDb } from "@/server/db";
import {
  inventoryReservationItems, inventoryReservations, products, productVariants,
} from "@/server/db/schema";

export type ReservationResult = { reservation_id:string; expires_at:string; status:"reserved"; replayed:boolean };
export class ReservationError extends Error {
  status: number;
  constructor(message:string,status=409){super(message);this.name="ReservationError";this.status=status;}
}
function requestHash(lines:CartLine[]):string {
  const normalized=[...lines].sort((a,b)=>(a.slug+"::"+(a.variantId??"")).localeCompare(b.slug+"::"+(b.variantId??"")));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export async function reserveInventory(userId:string,rawLines:unknown,idempotencyKey:string):Promise<ReservationResult>{
  const lines=normalizeCartLines(rawLines);
  if(!Array.isArray(rawLines)||lines.length<1||lines.length>20||rawLines.length!==lines.length){
    throw new ReservationError("Choose between one and twenty valid cart lines.",400);
  }
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)){
    throw new ReservationError("A valid UUID idempotency key is required.",400);
  }
  const hash=requestHash(lines);
  const db=getMySqlDb();
  return db.transaction(async tx=>{
    const now=new Date();
    const [existing]=await tx.select().from(inventoryReservations)
      .where(and(eq(inventoryReservations.userId,userId),eq(inventoryReservations.idempotencyKey,idempotencyKey)))
      .for("update").limit(1);
    if(existing){
      if(existing.requestHash!==hash)throw new ReservationError("This idempotency key was already used for a different cart. Start a new reservation.");
      if(existing.status==="reserved"&&existing.expiresAt>now){
        return {reservation_id:existing.id,expires_at:existing.expiresAt.toISOString(),status:"reserved",replayed:true};
      }
      if(existing.status==="reserved"){
        await tx.update(inventoryReservations).set({status:"expired",updatedAt:now}).where(eq(inventoryReservations.id,existing.id));
      }
      throw new ReservationError("This reservation request has expired. Start a new reservation.");
    }

    const slugs=lines.map(line=>line.slug);
    const productRows=await tx.select().from(products)
      .where(and(inArray(products.slug,slugs),eq(products.status,"active")))
      .for("update");
    const bySlug=new Map(productRows.map(row=>[row.slug,row]));
    if(bySlug.size!==lines.length)throw new ReservationError("A selected product is no longer available.");
    const productIds=productRows.map(row=>row.id);
    const variantRows=await tx.select().from(productVariants)
      .where(and(inArray(productVariants.productId,productIds),eq(productVariants.status,"active")))
      .for("update");
    const variantsByProduct=new Map<string,typeof variantRows>();
    for(const row of variantRows)variantsByProduct.set(row.productId,[...(variantsByProduct.get(row.productId)??[]),row]);

    const currencySet=new Set(lines.map(line=>bySlug.get(line.slug)?.currency));
    if(currencySet.size!==1||[...currencySet].some(currency=>!currency||!/^[A-Z]{3}$/.test(currency))){
      throw new ReservationError("Prepare one currency per checkout. Separate products priced in different currencies into different orders.",422);
    }
    const reservationRows=await tx.select({
      productId:inventoryReservationItems.productId,
      variantId:inventoryReservationItems.variantId,
      quantity:inventoryReservationItems.quantity,
    }).from(inventoryReservationItems)
      .innerJoin(inventoryReservations,eq(inventoryReservations.id,inventoryReservationItems.reservationId))
      .where(and(inArray(inventoryReservationItems.productId,productIds),
        eq(inventoryReservations.status,"reserved"),gt(inventoryReservations.expiresAt,now)));
    const reserved=new Map<string,number>();
    for(const row of reservationRows){
      const key=row.productId+"::"+(row.variantId??"");
      reserved.set(key,(reserved.get(key)??0)+row.quantity);
    }

    const resolved: {product:typeof productRows[number];variant:typeof variantRows[number]|null;line:CartLine;price:number;label:string|null;options:Record<string,unknown>}[]=[];
    for(const line of lines){
      const product=bySlug.get(line.slug);
      if(!product)throw new ReservationError("A selected product is no longer available.");
      const availableVariants=variantsByProduct.get(product.id)??[];
      const selectedVariant=line.variantId?availableVariants.find(v=>v.id===line.variantId)??null:null;
      if(availableVariants.length>0&&!selectedVariant)throw new ReservationError("Choose an active option for every product with variants.",422);
      if(line.variantId&&!selectedVariant)throw new ReservationError("A selected product option is no longer available.");
      const stockKey=product.id+"::"+(selectedVariant?.id??"");
      const current=selectedVariant?.quantityOnHand??product.quantityOnHand;
      const available=capPurchasableQuantity(current-(reserved.get(stockKey)??0),product.isOneOfAKind);
      if(available<line.quantity)throw new ReservationError("Not enough available stock for "+product.title+". Refresh the bag and try again.");
      const price=resolveVariantPriceMinor(selectedVariant?.priceOverrideMinor,product.priceMinor);
      if(price===null)throw new ReservationError("A verified price is missing for "+product.title+".");
      resolved.push({product,variant:selectedVariant,line,price,label:selectedVariant?.label??null,options:selectedVariant?.attributes&&typeof selectedVariant.attributes==="object"?selectedVariant.attributes:{}})
    }

    const reservationId=randomUUID();
    const expiresAt=new Date(now.getTime()+15*60*1000);
    await tx.insert(inventoryReservations).values({
      id:reservationId,userId,idempotencyKey,requestHash:hash,status:"reserved",
      expiresAt,createdAt:now,updatedAt:now,
    });
    for(const item of resolved){
      await tx.insert(inventoryReservationItems).values({
        id:randomUUID(),reservationId,productId:item.product.id,variantId:item.variant?.id??null,
        productTitle:item.product.title,productSku:item.variant?.sku??item.product.sku,
        variantLabel:item.label,selectedOptions:item.options,quantity:item.line.quantity,
        unitPriceMinor:item.price,currency:item.product.currency,createdAt:now,
      });
    }
    return {reservation_id:reservationId,expires_at:expiresAt.toISOString(),status:"reserved",replayed:false};
  });
}
