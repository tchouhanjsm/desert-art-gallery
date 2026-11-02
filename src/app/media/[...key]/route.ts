import { NextRequest, NextResponse } from "next/server";
import { isPublicEditorialMedia } from "@/server/editorial/repository";
import { getPublicMediaProduct } from "@/server/catalogue/repository";
import { readMedia, safeStorageKey } from "@/server/media/storage";
export const dynamic="force-dynamic";
export async function GET(_request:NextRequest,{params}:{params:Promise<{key:string[]}>}){
 let key:string;try{key=safeStorageKey((await params).key.join("/"));}catch{return new NextResponse(null,{status:404});}
 try{
  const allowed=key.startsWith("editorial/")?await isPublicEditorialMedia(key):await getPublicMediaProduct(key);
  if(!allowed)return new NextResponse(null,{status:404,headers:{"Cache-Control":"no-store"}});
  const asset=await readMedia(key);if(!asset)return new NextResponse(null,{status:404,headers:{"Cache-Control":"no-store"}});
  return new NextResponse(new Uint8Array(asset.bytes),{status:200,headers:{"Content-Type":asset.mimeType,"Content-Length":String(asset.bytes.byteLength),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox","Cross-Origin-Resource-Policy":"same-origin"}});
 }catch{return new NextResponse(null,{status:404,headers:{"Cache-Control":"no-store"}});}
}
