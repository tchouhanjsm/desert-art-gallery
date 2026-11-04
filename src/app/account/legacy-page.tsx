import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoneyFromMinor } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteAddress, saveAddress, signOutCustomer, updateProfile } from "./actions";

export const metadata = { title: "My account", robots: { index: false, follow: false } };

type OrderRow = { id: string; order_number: string; status: string; currency: string; total_minor: number; created_at: string; tracking_carrier: string | null; tracking_number: string | null; tracking_url: string | null };
type AddressRow = { id: string; recipient_name: string; address_line_1: string; address_line_2: string | null; city: string; region: string | null; postal_code: string; country_code: string; is_default_shipping: boolean };

function formatLegacyOrderStatus(status: string) {
  const labels: Record<string, string> = {
    draft: "Order draft", pending_payment: "Awaiting payment", paid: "Paid",
    processing: "Processing", shipped: "Shipped", delivered: "Delivered",
    cancelled: "Cancelled", refunded: "Refunded", expired: "Expired",
  };
  return labels[status] ?? "Status pending";
}

function safeTrackingUrl(value: string | null) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null; } catch { return null; }
}

export async function LegacyAccountPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell"><div className="page-heading"><div className="section-kicker">CUSTOMER ACCOUNT</div><h1>MY ACCOUNT</h1><p>Account features will be available once the database connection is configured.</p></div><div className="empty-note"><Link href="/contact">Contact the gallery</Link> Contact us if you need help with an existing order.</div></div>;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const [profileResult, orderResult, addressResult] = await Promise.all([
    supabase.from("profiles").select("email,full_name,phone").eq("id", user.id).maybeSingle(),
    supabase.from("orders").select("id,order_number,status,currency,total_minor,created_at,tracking_carrier,tracking_number,tracking_url").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("addresses").select("id,recipient_name,address_line_1,address_line_2,city,region,postal_code,country_code,is_default_shipping").eq("user_id", user.id).order("is_default_shipping", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (profileResult.error || orderResult.error || addressResult.error) throw new Error("Unable to load account information.");
  const profile = profileResult.data;
  const orders = (orderResult.data ?? []) as OrderRow[];
  const addresses = (addressResult.data ?? []) as AddressRow[];

  return <div className="page-shell account-shell">
    <div className="admin-page-heading"><div><div className="section-kicker">MY ACCOUNT</div><h1>Welcome{profile?.full_name ? ", " + profile.full_name : ""}</h1><p>Manage your details, delivery addresses and orders.</p></div><form action={signOutCustomer}><button className="button-outline" type="submit">Sign out</button></form></div>
    <section className="account-section">
      <div className="section-kicker">YOUR DETAILS</div><h2>Profile</h2>
      <form action={updateProfile} className="account-profile-form">
        <label>Full name<input name="full_name" defaultValue={profile?.full_name ?? ""} maxLength={160} required /></label>
        <label>Email address<input value={user.email ?? ""} readOnly aria-readonly="true" /></label>
        <label>Phone number<input name="phone" defaultValue={profile?.phone ?? ""} maxLength={40} /></label>
        <button className="button-primary dark-button" type="submit">Save changes</button>
      </form>
    </section>
    <section className="account-section">
      <div className="section-kicker">DELIVERY ADDRESSES</div><h2>Saved addresses</h2>
      {addresses.length ? <div className="account-address-grid">{addresses.map((address) => <article className="account-address" key={address.id}>
        {address.is_default_shipping && <span className="admin-status status-active">Default delivery address</span>}
        <strong>{address.recipient_name}</strong><p>{address.address_line_1}{address.address_line_2 ? ", " + address.address_line_2 : ""}<br/>{address.city}{address.region ? ", " + address.region : ""} {address.postal_code}<br/>{address.country_code}</p>
        <details className="address-edit"><summary>Edit address</summary><form action={saveAddress} className="address-form">
          <input type="hidden" name="id" value={address.id} />
          <label>Recipient name<input name="recipient_name" defaultValue={address.recipient_name} required maxLength={160}/></label>
          <label>Street address<input name="address_line_1" defaultValue={address.address_line_1} required maxLength={240}/></label>
          <label>Apartment, suite or building<input name="address_line_2" defaultValue={address.address_line_2 ?? ""} maxLength={240}/></label>
          <label>City<input name="city" defaultValue={address.city} required maxLength={120}/></label>
          <label>State / region<input name="region" defaultValue={address.region ?? ""} maxLength={120}/></label>
          <label>Postal code<input name="postal_code" defaultValue={address.postal_code} required maxLength={24}/></label>
          <label>Country code<input name="country_code" defaultValue={address.country_code} required minLength={2} maxLength={2} pattern="[A-Za-z]{2}"/></label>
          <label>Phone number<input name="phone" maxLength={40}/></label>
          <label className="address-default"><input type="checkbox" name="is_default_shipping" value="yes" defaultChecked={address.is_default_shipping}/> Set as default delivery address</label>
          <button type="submit" className="button-outline">Save address</button>
        </form></details>
        <form action={deleteAddress}><input type="hidden" name="id" value={address.id}/><button type="submit" className="address-delete">Remove address</button></form>
      </article>)}</div> : <div className="empty-note">You have not saved a delivery address yet. Add one below.</div>}
      <details className="address-add"><summary>Add a delivery address</summary><form action={saveAddress} className="address-form">
        <label>Recipient name<input name="recipient_name" required maxLength={160}/></label>
        <label>Street address<input name="address_line_1" required maxLength={240}/></label>
        <label>Apartment, suite or building<input name="address_line_2" maxLength={240}/></label>
        <label>City<input name="city" required maxLength={120}/></label>
        <label>State / region<input name="region" maxLength={120}/></label>
        <label>Postal code<input name="postal_code" required maxLength={24}/></label>
        <label>Country code<input name="country_code" placeholder="e.g. JP, IN, US" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}"/></label>
        <label>Phone number<input name="phone" maxLength={40}/></label>
        <label className="address-default"><input type="checkbox" name="is_default_shipping" value="yes"/> Set as default delivery address</label>
        <button type="submit" className="button-primary dark-button">Save address</button>
      </form></details>
    </section>
    <section className="account-section">
      <div className="section-kicker">ORDER HISTORY</div><h2>Orders</h2>
      {orders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order number</th><th>Date</th><th>Status</th><th>Total</th><th>Tracking</th></tr></thead><tbody>
        {orders.map((order) => <tr key={order.id}><td><Link href={"/account/orders/" + order.id}>{order.order_number}</Link></td><td>{new Date(order.created_at).toLocaleDateString("en-IN")}</td><td><span className={"admin-status status-" + order.status}>{formatLegacyOrderStatus(order.status)}</span></td><td>{formatMoneyFromMinor(order.total_minor, order.currency)}</td><td>{safeTrackingUrl(order.tracking_url) ? <a href={safeTrackingUrl(order.tracking_url) ?? undefined} target="_blank" rel="noreferrer">{order.tracking_carrier || "Track shipment"}</a> : order.tracking_number || "—"}</td></tr>)}
      </tbody></table></div> : <div className="empty-note">There is no order history for this account yet.</div>}
    </section>
  </div>;
}
