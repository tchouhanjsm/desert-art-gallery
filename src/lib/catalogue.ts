import { cache } from "react";
import type { Product } from "@/lib/products";
import { getPublishedProduct, listPublishedCollections, listPublishedProducts } from "@/server/catalogue/repository";
export type StorefrontCollection={name:string;slug:string;description:string;image:string;imageAlt:string};
export async function getStorefrontProducts():Promise<Product[]>{return listPublishedProducts();}
export async function getStorefrontCollections():Promise<StorefrontCollection[]>{return listPublishedCollections();}
export const getStorefrontProduct=cache(async(slug:string):Promise<Product|null>=>getPublishedProduct(slug));
