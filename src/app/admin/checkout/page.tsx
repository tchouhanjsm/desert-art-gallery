import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireOwner } from "@/server/auth/session";
import { getMySqlDb } from "@/server/db";
import { checkoutTaxRules, shippingRates, shippingZones } from "@/server/db/schema";
import { formatMinorForInput } from "@/lib/checkout";
import { saveShippingRate, saveShippingZone, saveTaxRule } from "./actions";

export const metadata = { title: "Shipping and tax configuration", robots: { index: false, follow: false } };

export default async function AdminCheckoutSettingsPage() {
  await requireOwner();
  const db=getMySqlDb();
  const [zoneRows,rateRows,taxRows]=await Promise.all([
    db.select().from(shippingZones).orderBy(asc(shippingZones.name)),
    db.select().from(shippingRates).orderBy(asc(shippingRates.name)),
    db.select().from(checkoutTaxRules).orderBy(asc(checkoutTaxRules.countryCode),asc(checkoutTaxRules.currency)),
  ]);
  const zones=zoneRows.map(row=>({id:row.id,name:row.name,country_codes:row.countryCodes,is_active:row.isActive}));
  const rates=rateRows.map(row=>({id:row.id,zone_id:row.zoneId,name:row.name,currency:row.currency,amount_minor:row.amountMinor,min_delivery_days:row.minDeliveryDays,max_delivery_days:row.maxDeliveryDays,duties_disclosure:row.dutiesDisclosure,is_active:row.isActive}));
  const taxes=taxRows.map(row=>({id:row.id,country_code:row.countryCode,currency:row.currency,tax_name:row.taxName,rate_basis_points:row.rateBasisPoints,taxable_shipping:row.taxableShipping,disclosure:row.disclosure,is_active:row.isActive}));
  return <div className="page-shell">
    <div className="admin-page-heading"><div><div className="section-kicker">OWNER WORKSPACE</div><h1>Shipping & tax</h1><p>Only approved merchant rates, delivery windows and legal disclosures belong here.</p></div><Link className="text-link" href="/admin">DASHBOARD</Link></div>
    <div className="checkout-notice">Checkout fails closed unless exactly one active shipping zone matches the destination, a matching active rate exists, and at least one active tax rule is configured for the same country and currency. An explicit zero-rate tax rule is required when no tax applies. The tax calculation is an additive basis-point scaffold, not a jurisdiction-complete tax engine; obtain accountant approval before activating any destination. No example prices or policies are preloaded.</div>

    <section className="checkout-section">
      <div className="section-kicker">01 / SHIPPING ZONES</div><h2>Destination coverage</h2>
      <form action={saveShippingZone} className="checkout-admin-form">
        <label>Zone name<input name="name" required maxLength={120}/></label>
        <label>Country codes<input name="country_codes" required placeholder="IN, US, GB" maxLength={500}/></label>
        <label className="checkout-checkbox"><input type="checkbox" name="is_active" value="yes"/> Active</label>
        <button className="button-primary dark-button" type="submit">ADD SHIPPING ZONE</button>
      </form>
      <div className="checkout-config-list">{zones.map((zone) => <form action={saveShippingZone} className="checkout-config-item" key={zone.id}>
        <input type="hidden" name="id" value={zone.id}/>
        <label>Zone name<input name="name" defaultValue={zone.name} required maxLength={120}/></label>
        <label>Country codes<input name="country_codes" defaultValue={zone.country_codes.join(", ")} required maxLength={500}/></label>
        <label className="checkout-checkbox"><input type="checkbox" name="is_active" value="yes" defaultChecked={zone.is_active}/> Active</label>
        <button className="button-outline" type="submit">SAVE ZONE</button>
      </form>)}</div>
    </section>

    <section className="checkout-section">
      <div className="section-kicker">02 / SHIPPING RATES</div><h2>Merchant-approved delivery options</h2>
      <form action={saveShippingRate} className="checkout-admin-form">
        <label>Shipping zone<select name="zone_id" required defaultValue=""><option value="" disabled>Select a zone</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} ({zone.country_codes.join(", ")})</option>)}</select></label>
        <label>Rate name<input name="name" required maxLength={120}/></label>
        <label>Currency<input name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" placeholder="INR, USD…"/></label>
        <label>Amount in major units<input name="amount" required inputMode="decimal" placeholder="Enter approved amount"/></label>
        <label>Minimum delivery days<input name="min_delivery_days" inputMode="numeric" maxLength={3}/></label>
        <label>Maximum delivery days<input name="max_delivery_days" inputMode="numeric" maxLength={3}/></label>
        <label className="checkout-admin-wide">Duties and delivery disclosure<textarea name="duties_disclosure" required maxLength={2000} rows={3}/></label>
        <label className="checkout-checkbox"><input type="checkbox" name="is_active" value="yes"/> Active</label>
        <button className="button-primary dark-button" type="submit">ADD SHIPPING RATE</button>
      </form>
      <div className="checkout-config-list">{rates.map((rate) => <form action={saveShippingRate} className="checkout-config-item" key={rate.id}>
        <input type="hidden" name="id" value={rate.id}/>
        <label>Zone<select name="zone_id" defaultValue={rate.zone_id} required>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
        <label>Rate name<input name="name" defaultValue={rate.name} required maxLength={120}/></label>
        <label>Currency<input name="currency" defaultValue={rate.currency} required minLength={3} maxLength={3} pattern="[A-Za-z]{3}"/></label>
        <label>Amount<input name="amount" defaultValue={formatMinorForInput(rate.amount_minor, rate.currency)} required inputMode="decimal"/></label>
        <label>Minimum days<input name="min_delivery_days" defaultValue={rate.min_delivery_days ?? ""} inputMode="numeric" maxLength={3}/></label>
        <label>Maximum days<input name="max_delivery_days" defaultValue={rate.max_delivery_days ?? ""} inputMode="numeric" maxLength={3}/></label>
        <label className="checkout-admin-wide">Duties disclosure<textarea name="duties_disclosure" defaultValue={rate.duties_disclosure ?? ""} required maxLength={2000} rows={3}/></label>
        <label className="checkout-checkbox"><input type="checkbox" name="is_active" value="yes" defaultChecked={rate.is_active}/> Active</label>
        <button className="button-outline" type="submit">SAVE RATE</button>
      </form>)}</div>
    </section>

    <section className="checkout-section">
      <div className="section-kicker">03 / TAX RULES</div><h2>Destination tax configuration</h2>
      <form action={saveTaxRule} className="checkout-admin-form">
        <label>Country code<input name="country_code" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}"/></label>
        <label>Currency<input name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" /></label>
        <label>Tax name<input name="tax_name" required maxLength={120}/></label>
        <label>Rate in basis points<input name="rate_basis_points" required type="number" min={0} max={10000} step={1}/></label>
        <label className="checkout-checkbox"><input type="checkbox" name="taxable_shipping" value="yes"/> Apply this rule to shipping</label>
        <label className="checkout-admin-wide">Tax disclosure<textarea name="disclosure" required maxLength={2000} rows={3}/></label>
        <label className="checkout-checkbox"><input type="checkbox" name="is_active" value="yes"/> Active</label>
        <button className="button-primary dark-button" type="submit">ADD TAX RULE</button>
      </form>
      <div className="checkout-config-list">{taxes.map((tax) => <form action={saveTaxRule} className="checkout-config-item" key={tax.id}>
        <input type="hidden" name="id" value={tax.id}/>
        <label>Country<input name="country_code" defaultValue={tax.country_code} required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" /></label>
        <label>Currency<input name="currency" defaultValue={tax.currency} required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" /></label>
        <label>Tax name<input name="tax_name" defaultValue={tax.tax_name} required maxLength={120}/></label>
        <label>Rate (basis points)<input name="rate_basis_points" defaultValue={tax.rate_basis_points} required type="number" min={0} max={10000} step={1}/></label>
        <label className="checkout-checkbox"><input type="checkbox" name="taxable_shipping" value="yes" defaultChecked={tax.taxable_shipping}/> Apply to shipping</label>
        <label className="checkout-admin-wide">Disclosure<textarea name="disclosure" defaultValue={tax.disclosure} required maxLength={2000} rows={3}/></label>
        <label className="checkout-checkbox"><input type="checkbox" name="is_active" value="yes" defaultChecked={tax.is_active}/> Active</label>
        <button className="button-outline" type="submit">SAVE TAX RULE</button>
      </form>)}</div>
    </section>
  </div>;
}
