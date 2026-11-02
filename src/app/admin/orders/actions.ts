"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/session";
import { getMySqlDb } from "@/server/db";
import { orders } from "@/server/db/schema";

function field(formData:FormData,key:string,max=300){const raw=formData.get(key);if(typeof raw!=="string")return "";const value=raw.trim();if(value.length>max)throw new Error(key+" is too long.");return value;}

export async function transitionOrder(formData:FormData){
 await requireAdmin();
 const id=field(formData,"id",80);const next=field(formData,"next_status",24);
 const carrier=field(formData,"tracking_carrier",120);const number=field(formData,"tracking_number",160);const rawUrl=field(formData,"tracking_url",1000);
 if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error("A valid order is required.");
 if(!["processing","shipped","delivered"].includes(next))throw new Error("The requested fulfilment step is not allowed.");
 let trackingUrl:string|null=null;
 if(rawUrl){try{const url=new URL(rawUrl);if(url.protocol!=="https:")throw new Error();trackingUrl=url.toString();}catch{throw new Error("Tracking URL must be a valid HTTPS link.");}}
 if(next==="shipped"&&(!carrier||!number))throw new Error("Carrier and tracking number are required before shipment.");
 const db=getMySqlDb();const now=new Date();
 await db.transaction(async tx=>{
  const [order]=await tx.select().from(orders).where(eq(orders.id,id)).for("update").limit(1);
  if(!order)throw new Error("Order was not found.");
  const valid=order.status==="paid"&&next==="processing"||order.status==="processing"&&next==="shipped"||order.status==="shipped"&&next==="delivered";
  if(!valid)throw new Error("The order is not at the preceding fulfilment state. Payment and refund statuses cannot be changed here.");
  await tx.update(orders).set({
   status:next,trackingCarrier:carrier||order.trackingCarrier,
   trackingNumber:number||order.trackingNumber,trackingUrl:trackingUrl||order.trackingUrl,
   shippedAt:next==="shipped"?now:order.shippedAt,
   deliveredAt:next==="delivered"?now:order.deliveredAt,
   updatedAt:now,
  }).where(eq(orders.id,id));
 });
 for(const path of ["/admin/orders","/admin/orders/"+id,"/account","/account/orders/"+id])revalidatePath(path);
}
