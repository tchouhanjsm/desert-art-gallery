"use server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isCheckoutUuid, normalizeCountryCodes, parseCurrencyAmountToMinor } from "@/lib/checkout";
import { requireOwner } from "@/server/auth/session";
import { getMySqlDb } from "@/server/db";
import { checkoutTaxRules, shippingRates, shippingZones } from "@/server/db/schema";

function field(formData:FormData,key:string,max=2000){const raw=formData.get(key);if(typeof raw!=="string")return "";const value=raw.trim();if(value.length>max)throw new Error(key+" is too long.");return value;}
function optionalDays(value:string):number|null{if(!value)return null;if(!/^\d{1,3}$/.test(value))throw new Error("Delivery days must be a whole number from 0 to 365.");const n=Number(value);if(!Number.isInteger(n)||n<0||n>365)throw new Error("Delivery days must be a whole number from 0 to 365.");return n;}
function updated(){revalidatePath("/admin/checkout");revalidatePath("/checkout");}

export async function saveShippingZone(formData:FormData){
 await requireOwner();const id=field(formData,"id",40);const name=field(formData,"name",120);const countries=normalizeCountryCodes(field(formData,"country_codes",500));
 if(!name||!countries)throw new Error("Provide a zone name and one or more valid two-letter country codes.");
 if(id&&!isCheckoutUuid(id))throw new Error("Invalid shipping zone identifier.");
 const values={name,countryCodes:countries,isActive:formData.get("is_active")==="yes",updatedAt:new Date()};
 if(id)await getMySqlDb().update(shippingZones).set(values).where(eq(shippingZones.id,id));
 else await getMySqlDb().insert(shippingZones).values({id:randomUUID(),...values,createdAt:new Date()});
 updated();
}

export async function saveShippingRate(formData:FormData){
 await requireOwner();const id=field(formData,"id",40);const zoneId=field(formData,"zone_id",40);
 const name=field(formData,"name",160);const currency=field(formData,"currency",3).toUpperCase();const amount=field(formData,"amount",32);
 const disclosure=field(formData,"duties_disclosure",2000);
 if(id&&!isCheckoutUuid(id))throw new Error("Invalid shipping rate identifier.");
 if(!isCheckoutUuid(zoneId)||!name||!/^[A-Z]{3}$/.test(currency)||!disclosure)throw new Error("A zone, rate name, ISO currency and merchant-approved duties disclosure are required.");
 const amountMinor=parseCurrencyAmountToMinor(amount,currency);if(amountMinor===null)throw new Error("Enter a valid shipping amount using this currency's supported precision.");
 const min=optionalDays(field(formData,"min_delivery_days",3));const max=optionalDays(field(formData,"max_delivery_days",3));
 if((min===null)!==(max===null))throw new Error("Enter both delivery-window endpoints or leave both blank.");
 if(min!==null&&max!==null&&max<min)throw new Error("Maximum delivery days cannot be lower than minimum delivery days.");
 const [zone]=await getMySqlDb().select({id:shippingZones.id}).from(shippingZones).where(eq(shippingZones.id,zoneId)).limit(1);
 if(!zone)throw new Error("The selected shipping zone was not found.");
 const values={zoneId,name,currency,amountMinor,minDeliveryDays:min,maxDeliveryDays:max,dutiesDisclosure:disclosure,isActive:formData.get("is_active")==="yes",updatedAt:new Date()};
 if(id)await getMySqlDb().update(shippingRates).set(values).where(eq(shippingRates.id,id));
 else await getMySqlDb().insert(shippingRates).values({id:randomUUID(),...values,createdAt:new Date()});
 updated();
}

export async function saveTaxRule(formData:FormData){
 await requireOwner();const id=field(formData,"id",40);const countryCode=field(formData,"country_code",2).toUpperCase();
 const currency=field(formData,"currency",3).toUpperCase();const taxName=field(formData,"tax_name",120);
 const disclosure=field(formData,"disclosure",2000);const rawRate=field(formData,"rate_basis_points",5);
 if(id&&!isCheckoutUuid(id))throw new Error("Invalid tax rule identifier.");
 if(!/^[A-Z]{2}$/.test(countryCode)||!/^[A-Z]{3}$/.test(currency)||!taxName||!disclosure||!/^\d{1,5}$/.test(rawRate))throw new Error("Provide a country, currency, tax name, basis-point rate and approved disclosure.");
 const rate=Number(rawRate);if(!Number.isInteger(rate)||rate<0||rate>10000)throw new Error("Tax rate must be between 0 and 10,000 basis points.");
 const values={countryCode,currency,taxName,rateBasisPoints:rate,taxableShipping:formData.get("taxable_shipping")==="yes",disclosure,isActive:formData.get("is_active")==="yes",updatedAt:new Date()};
 if(id)await getMySqlDb().update(checkoutTaxRules).set(values).where(eq(checkoutTaxRules.id,id));
 else await getMySqlDb().insert(checkoutTaxRules).values({id:randomUUID(),...values,createdAt:new Date()});
 updated();
}
