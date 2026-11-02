import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, inArray } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { isCheckoutUuid, normalizeCheckoutAddress } from "@/lib/checkout";
import { isSameOriginRequest } from "@/lib/request-security";
import { getCurrentUser } from "@/server/auth/session";
import { getMySqlDb } from "@/server/db";
import {
  checkoutTaxRules, inventoryReservationItems, inventoryReservations,
  orders, orderItems, shippingRates, shippingZones,
} from "@/server/db/schema";

export const dynamic="force-dynamic";

function safeText(value:unknown,max:number):string|null{
 if(typeof value!=="string")return null;const text=value.trim();return text.length<=max?text:null;
}
function toSafeInteger(value:bigint):number{
 const number=Number(value);if(!Number.isSafeInteger(number)||number<0)throw new Error("The order total exceeds the supported amount.");return number;
}
function requestHash(value:unknown):string{return createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function orderNumber():string{return "DAG-"+Date.now().toString(36).toUpperCase()+"-"+randomBytes(3).toString("hex").toUpperCase();}

export async function POST(request:NextRequest){
 if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin request rejected."},{status:403,headers:{"Cache-Control":"no-store"}});
 const user=await getCurrentUser();if(!user)return NextResponse.json({error:"Sign in before preparing an order."},{status:401,headers:{"Cache-Control":"no-store"}});
 const length=Number(request.headers.get("content-length")??"0");if(Number.isFinite(length)&&length>12_000)return NextResponse.json({error:"Order request is too large."},{status:413});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid order request."},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid order request."},{status:400});
 const input=body as Record<string,unknown>;
 const reservationId=typeof input.reservationId==="string"?input.reservationId:"";
 const shippingRateId=typeof input.shippingRateId==="string"?input.shippingRateId:"";
 const idempotencyKey=typeof input.idempotencyKey==="string"?input.idempotencyKey:"";
 const shippingAddress=normalizeCheckoutAddress(input.shippingAddress);
 const customerNote=safeText(input.customerNote??"",1000);
 if(!isCheckoutUuid(reservationId)||!isCheckoutUuid(shippingRateId)||!isCheckoutUuid(idempotencyKey)||!shippingAddress||customerNote===null){
  return NextResponse.json({error:"Provide a valid reservation, delivery option and complete delivery address."},{status:400});
 }
 const hash=requestHash({reservationId,shippingRateId,shippingAddress,customerNote});
 const db=getMySqlDb();
 const [prior]=await db.select({id:orders.id,requestHash:orders.checkoutRequestHash}).from(orders)
  .where(and(eq(orders.userId,user.id),eq(orders.checkoutIdempotencyKey,idempotencyKey))).limit(1);
 if(prior){
  if(prior.requestHash!==hash)return NextResponse.json({error:"This checkout key was already used for a different order request."},{status:409});
  return NextResponse.json({order_id:prior.id,replayed:true},{headers:{"Cache-Control":"no-store"}});
 }

 try{
  const result=await db.transaction(async tx=>{
   const [priorInside]=await tx.select({id:orders.id,requestHash:orders.checkoutRequestHash}).from(orders)
    .where(and(eq(orders.userId,user.id),eq(orders.checkoutIdempotencyKey,idempotencyKey))).for("update").limit(1);
   if(priorInside){
    if(priorInside.requestHash!==hash)throw new Error("This checkout key was already used for a different order request.");
    return {orderId:priorInside.id,replayed:true};
   }
   const now=new Date();
   const [reservation]=await tx.select().from(inventoryReservations)
    .where(and(eq(inventoryReservations.id,reservationId),eq(inventoryReservations.userId,user.id)))
    .for("update").limit(1);
   if(!reservation||reservation.status!=="reserved"||reservation.expiresAt<=now){
    if(reservation?.status==="reserved")await tx.update(inventoryReservations).set({status:"expired",updatedAt:now}).where(eq(inventoryReservations.id,reservationId));
    throw new Error("The inventory reservation has expired. Return to your bag and reserve the current items again.");
   }
   const reservedItems=await tx.select().from(inventoryReservationItems)
    .where(eq(inventoryReservationItems.reservationId,reservationId));
   if(!reservedItems.length)throw new Error("The reservation contains no order items.");
   const currencies=new Set(reservedItems.map(row=>row.currency));
   if(currencies.size!==1)throw new Error("One currency per order is required.");
   const currency=reservedItems[0].currency;
   const subtotalBig=reservedItems.reduce((sum,row)=>sum+BigInt(row.unitPriceMinor)*BigInt(row.quantity),0n);
   const subtotal=toSafeInteger(subtotalBig);

   const [rate]=await tx.select().from(shippingRates)
    .where(and(eq(shippingRates.id,shippingRateId),eq(shippingRates.isActive,true))).limit(1);
   if(!rate||rate.currency!==currency)throw new Error("The selected shipping option is no longer available for this order currency.");
   const activeZones=await tx.select().from(shippingZones).where(eq(shippingZones.isActive,true));
   const matchingZones=activeZones.filter(zone=>Array.isArray(zone.countryCodes)&&zone.countryCodes.includes(shippingAddress.country_code));
   if(matchingZones.length!==1||matchingZones[0].id!==rate.zoneId)throw new Error("The shipping zone does not uniquely cover this destination. Contact the gallery before preparing an order.");
   const zone=matchingZones[0];

   const applicableTaxes=await tx.select().from(checkoutTaxRules)
    .where(and(eq(checkoutTaxRules.isActive,true),eq(checkoutTaxRules.countryCode,shippingAddress.country_code),eq(checkoutTaxRules.currency,currency)));
   if(!applicableTaxes.length)throw new Error("No approved tax configuration exists for this country and currency. Checkout is unavailable until the owner configures a tax rule, including an explicit zero-rate rule where appropriate.");
   let taxTotal=0n;
   const taxBreakdown=applicableTaxes.map(rule=>{
    const taxableBase=subtotalBig+(rule.taxableShipping?BigInt(rate.amountMinor):0n);
    const amount=(taxableBase*BigInt(rule.rateBasisPoints))/10000n;
    taxTotal+=amount;
    return {name:rule.taxName,rate_basis_points:rule.rateBasisPoints,amount_minor:toSafeInteger(amount)};
   });
   const shipping=rate.amountMinor;
   const tax=toSafeInteger(taxTotal);
   const total=toSafeInteger(subtotalBig+BigInt(shipping)+tax);
   const id=randomUUID();
   const number=orderNumber();
   const orderExpiry=reservation.expiresAt;

   await tx.insert(orders).values({
    id,orderNumber:number,userId:user.id,email:user.email,currency,status:"draft",
    subtotalMinor:subtotal,shippingMinor:shipping,taxMinor:tax,discountMinor:0,totalMinor:total,
    shippingAddress,billingAddress:null,customerNote:customerNote||null,reservationId,
    checkoutIdempotencyKey:idempotencyKey,checkoutRequestHash:hash,expiresAt:orderExpiry,
    shippingRateId:rate.id,shippingZoneName:zone.name,shippingRateName:rate.name,
    shippingDeliveryMinDays:rate.minDeliveryDays,shippingDeliveryMaxDays:rate.maxDeliveryDays,
    dutiesDisclosure:rate.dutiesDisclosure,taxBreakdown,
    taxDisclosure:applicableTaxes.map(rule=>rule.disclosure).join("\n\n"),
    placedAt:now,createdAt:now,updatedAt:now,
   });
   await tx.insert(orderItems).values(reservedItems.map(row=>({
    id:randomUUID(),orderId:id,productId:row.productId,variantId:row.variantId,
    productTitle:row.productTitle,productSku:row.productSku,variantLabel:row.variantLabel,
    quantity:row.quantity,unitPriceMinor:row.unitPriceMinor,
    lineTotalMinor:toSafeInteger(BigInt(row.unitPriceMinor)*BigInt(row.quantity)),
    selectedOptions:row.selectedOptions,createdAt:now,
   })));
   return {orderId:id,replayed:false};
  });
  return NextResponse.json({order_id:result.orderId,replayed:result.replayed},{status:result.replayed?200:201,headers:{"Cache-Control":"no-store"}});
 }catch(error){
  const message=error instanceof Error?error.message:"The order draft could not be prepared.";
  return NextResponse.json({error:message},{status:409,headers:{"Cache-Control":"no-store"}});
 }
}
