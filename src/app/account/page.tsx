import Link from "next/link";
import { formatMoneyFromMinor } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { getMySqlDb } from "@/server/db";
import { addresses, orders } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";
import { deleteAddress, saveAddress, signOutCustomer, updateProfile } from "./actions";

export const metadata = { title: "My account" };

function safeTrackingUrl(value: string | null) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null; }
  catch { return null; }
}

export default async function AccountPage() {
  const user = await requireUser();
  const [orderRows, addressRows] = await Promise.all([
    getMySqlDb().select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(50),
    getMySqlDb().select().from(addresses).where(eq(addresses.userId, user.id))
      .orderBy(desc(addresses.isDefaultShipping), desc(addresses.createdAt)),
  ]);
  const profile = { full_name: user.fullName, phone: user.phone };
  const ordersList = orderRows.map(row => ({
    id: row.id, order_number: row.orderNumber, status: row.status, currency: row.currency,
    total_minor: row.totalMinor, created_at: row.createdAt.toISOString(),
    tracking_carrier: row.trackingCarrier, tracking_number: row.trackingNumber, tracking_url: row.trackingUrl,
  }));
  const savedAddresses = addressRows.map(row => ({
    id: row.id, recipient_name: row.recipientName, address_line_1: row.addressLine1,
    address_line_2: row.addressLine2, city: row.city, region: row.region, postal_code: row.postalCode,
    country_code: row.countryCode, is_default_shipping: row.isDefaultShipping,
  }));

  return <div className="page-shell account-shell">
    <div className="admin-page-heading"><div><div className="section-kicker">YOUR DESERT ART GALLERY</div><h1>Welcome{profile.full_name ? ", " + profile.full_name : ""}</h1><p>Manage your details, delivery addresses and orders.</p></div><form action={signOutCustomer}><button className="button-outline" type="submit">SIGN OUT</button></form></div>
    <section className="account-section">
      <div className="section-kicker">PERSONAL DETAILS</div><h2>Your profile</h2>
      <form action={updateProfile} className="account-profile-form">
        <label>Full name<input name="full_name" defaultValue={profile.full_name} maxLength={160} required /></label>
        <label>Email address<input value={user.email} readOnly aria-readonly="true" /></label>
        <label>Phone number<input name="phone" defaultValue={profile.phone} maxLength={40} /></label>
        <button className="button-primary dark-button" type="submit">SAVE DETAILS</button>
      </form>
    </section>
    <section className="account-section">
      <div className="section-kicker">DELIVERY DETAILS</div><h2>Saved addresses</h2>
      {savedAddresses.length ? <div className="account-address-grid">{savedAddresses.map(address => <article className="account-address" key={address.id}>
        {address.is_default_shipping && <span className="admin-status status-active">DEFAULT SHIPPING</span>}
        <strong>{address.recipient_name}</strong><p>{address.address_line_1}{address.address_line_2 ? ", " + address.address_line_2 : ""}<br/>{address.city}{address.region ? ", " + address.region : ""} {address.postal_code}<br/>{address.country_code}</p>
        <details className="address-edit"><summary>EDIT ADDRESS</summary><form action={saveAddress} className="address-form">
          <input type="hidden" name="id" value={address.id}/>
          <label>Recipient<input name="recipient_name" defaultValue={address.recipient_name} required maxLength={160}/></label>
          <label>Address line 1<input name="address_line_1" defaultValue={address.address_line_1} required maxLength={240}/></label>
          <label>Address line 2<input name="address_line_2" defaultValue={address.address_line_2 ?? ""} maxLength={240}/></label>
          <label>City<input name="city" defaultValue={address.city} required maxLength={120}/></label>
          <label>State / region<input name="region" defaultValue={address.region ?? ""} maxLength={120}/></label>
          <label>Postal code<input name="postal_code" defaultValue={address.postal_code} required maxLength={24}/></label>
          <label>Country code<input name="country_code" defaultValue={address.country_code} required minLength={2} maxLength={2} pattern="[A-Za-z]{2}"/></label>
          <label>Phone<input name="phone" defaultValue={address.phone ?? ""} maxLength={40}/></label>
          <label className="address-default"><input type="checkbox" name="is_default_shipping" value="yes" defaultChecked={address.is_default_shipping}/> Default shipping address</label>
          <button type="submit" className="button-outline">SAVE ADDRESS</button>
        </form></details>
        <form action={deleteAddress}><input type="hidden" name="id" value={address.id}/><button type="submit" className="address-delete">DELETE ADDRESS</button></form>
      </article>)}</div> : <div className="empty-note">No delivery addresses have been saved yet. Add a delivery address below.</div>}
      <details className="address-add"><summary>ADD A DELIVERY ADDRESS</summary><form action={saveAddress} className="address-form">
        <label>Recipient<input name="recipient_name" required maxLength={160}/></label>
        <label>Address line 1<input name="address_line_1" required maxLength={240}/></label>
        <label>Address line 2<input name="address_line_2" maxLength={240}/></label>
        <label>City<input name="city" required maxLength={120}/></label>
        <label>State / region<input name="region" maxLength={120}/></label>
        <label>Postal code<input name="postal_code" required maxLength={24}/></label>
        <label>Country code<input name="country_code" placeholder="IN, US, GB…" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}"/></label>
        <label>Phone<input name="phone" maxLength={40}/></label>
        <label className="address-default"><input type="checkbox" name="is_default_shipping" value="yes"/> Default shipping address</label>
        <button type="submit" className="button-primary dark-button">SAVE ADDRESS</button>
      </form></details>
    </section>
    <section className="account-section">
      <div className="section-kicker">ORDER HISTORY</div><h2>Your orders</h2>
      {ordersList.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>DATE</th><th>STATUS</th><th>TOTAL</th><th>TRACKING</th></tr></thead><tbody>
        {ordersList.map(order => <tr key={order.id}><td><Link href={"/account/orders/" + order.id}>{order.order_number}</Link></td><td>{new Date(order.created_at).toLocaleDateString("en-IN")}</td><td><span className={"admin-status status-" + order.status}>{order.status.replaceAll("_"," ")}</span></td><td>{formatMoneyFromMinor(order.total_minor,order.currency)}</td><td>{safeTrackingUrl(order.tracking_url) ? <a href={safeTrackingUrl(order.tracking_url) ?? undefined} target="_blank" rel="noreferrer">{order.tracking_carrier || "Track parcel"}</a> : order.tracking_number || "—"}</td></tr>)}
      </tbody></table></div> : <div className="empty-note">Your orders will appear here after the gallery receives an online order.</div>}
    </section>
  </div>;
}
