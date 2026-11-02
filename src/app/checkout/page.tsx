import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { CheckoutForm } from "@/components/CheckoutForm";
import { requireUser } from "@/server/auth/session";
import { getMySqlDb } from "@/server/db";
import { addresses, checkoutTaxRules, shippingRates, shippingZones } from "@/server/db/schema";

export const metadata = {
 title:"Delivery and order review",
 description:"Review delivery details and prepare an unpaid order draft.",
 robots:{index:false,follow:false},
};

export default async function CheckoutPage(){
 const user=await requireUser();
 const db=getMySqlDb();
 const [addressRows,zoneRows,rateRows,taxRows]=await Promise.all([
  db.select().from(addresses).where(eq(addresses.userId,user.id)).orderBy(desc(addresses.isDefaultShipping),desc(addresses.createdAt)),
  db.select().from(shippingZones).where(eq(shippingZones.isActive,true)).orderBy(asc(shippingZones.name)),
  db.select().from(shippingRates).where(eq(shippingRates.isActive,true)).orderBy(asc(shippingRates.name)),
  db.select().from(checkoutTaxRules).where(eq(checkoutTaxRules.isActive,true)).orderBy(asc(checkoutTaxRules.countryCode),asc(checkoutTaxRules.currency)),
 ]);
 const savedAddresses=addressRows.map(row=>({
  id:row.id,recipient_name:row.recipientName,address_line_1:row.addressLine1,
  address_line_2:row.addressLine2??"",city:row.city,region:row.region??"",
  postal_code:row.postalCode,country_code:row.countryCode,phone:row.phone??"",
  is_default_shipping:row.isDefaultShipping,
 }));
 const zones=zoneRows.map(row=>({id:row.id,name:row.name,country_codes:row.countryCodes}));
 const rates=rateRows.map(row=>({
  id:row.id,zone_id:row.zoneId,name:row.name,currency:row.currency,amount_minor:row.amountMinor,
  min_delivery_days:row.minDeliveryDays,max_delivery_days:row.maxDeliveryDays,
  duties_disclosure:row.dutiesDisclosure,
 }));
 const taxRules=taxRows.map(row=>({
  id:row.id,country_code:row.countryCode,currency:row.currency,tax_name:row.taxName,
  rate_basis_points:row.rateBasisPoints,taxable_shipping:row.taxableShipping,disclosure:row.disclosure,
 }));
 return <div className="page-shell">
  <div className="page-heading"><div className="section-kicker">ORDER REVIEW</div><h1>Delivery details</h1><p>Choose a configured delivery option and review the destination disclosures.</p></div>
  <CheckoutForm addresses={savedAddresses} zones={zones} rates={rates} taxRules={taxRules}/>
 </div>;
}
