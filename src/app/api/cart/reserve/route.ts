import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/request-security";
import { getCurrentUser } from "@/server/auth/session";
import { ReservationError, reserveInventory } from "@/server/commerce/reservations";

export const dynamic="force-dynamic";

export async function POST(request:NextRequest){
 if(!isSameOriginRequest(request))return NextResponse.json({error:"Cross-origin request rejected."},{status:403,headers:{"Cache-Control":"no-store"}});
 const user=await getCurrentUser();
 if(!user)return NextResponse.json({error:"Sign in before reserving inventory."},{status:401,headers:{"Cache-Control":"no-store"}});
 const key=request.headers.get("Idempotency-Key")?.trim()??"";
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid reservation request."},{status:400});}
 try{
  const result=await reserveInventory(user.id,body&&typeof body==="object"?(body as {lines?:unknown}).lines:undefined,key);
  return NextResponse.json(result,{status:result.replayed?200:201,headers:{"Cache-Control":"no-store"}});
 }catch(error){
  if(error instanceof ReservationError)return NextResponse.json({error:error.message},{status:error.status,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({error:"Inventory could not be reserved. Refresh the bag and try again."},{status:409,headers:{"Cache-Control":"no-store"}});
 }
}
