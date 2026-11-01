import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoneyFromMinor } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOutCustomer, updateProfile } from "./actions";

export const metadata = { title: "My account" };

type OrderRow = { id: string; order_number: string; status: string; currency: string; total_minor: number; created_at: string; tracking_carrier: string | null; tracking_number: string | null; tracking_url: string | null };
type AddressRow = { id: string; recipient_name: string; address_line_1: string; address_line_2: string | null; city: string; region: string | null; postal_code: string; country_code: string; is_default_shipping: boolean };

function safeTrackingUrl(value: string | null) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null; } catch { return null; }
}

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell"><div className="page-heading"><div className="section-kicker">CLIENT ACCOUNT</div><h1>Your account</h1><p>Account services will be available when the database connection is configured.</p></div><div className="empty-note"><Link href="/contact">Contact the gallery</Link> for help with an existing order.</div></div>;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const [profileResult, orderResult, addressResult] = await Promise.all([
    supabase.from("profiles").select("email,full_name,phone").eq("id", user.id).maybeSingle(),
    supabase.from("orders").select("id,order_number,status,currency,total_minor,created_at,tracking_carrier,tracking_number,tracking_url").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("addresses").select("id,recipient_name,address_line_1,address_line_2,city,region,postal_code,country_code,is_default_shipping").eq("user_id", user.id).order("is_default_shipping", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (profileResult.error || orderResult.error || addressResult.error) throw new Error("Unable to load your account information.");
  const profile = profileResult.data;
  const orders = (orderResult.data ?? []) as OrderRow[];
  const addresses = (addressResult.data ?? []) as AddressRow[];

  return <div className="page-shell account-shell">
    <div className="admin-page-heading"><div><div className="section-kicker">YOUR DESERT ART GALLERY</div><h1>Welcome{profile?.full_name ? ", " + profile.full_name : ""}</h1><p>Manage your details, delivery addresses and orders.</p></div><form action={signOutCustomer}><button className="button-outline" type="submit">SIGN OUT</button></form></div>
    <section className="account-section">
      <div className="section-kicker">PERSONAL DETAILS</div><h2>Your profile</h2>
      <form action={updateProfile} className="account-profile-form">
        <label>Full name<input name="full_name" defaultValue={profile?.full_name ?? ""} maxLength={160} required /></label>
        <label>Email address<input value={user.email ?? ""} readOnly aria-readonly="true" /></label>
        <label>Phone number<input name="phone" defaultValue={profile?.phone ?? ""} maxLength={40} /></label>
        <button className="button-primary dark-button" type="submit">SAVE DETAILS</button>
      </form>
    </section>
    <section className="account-section">
      <div className="section-kicker">DELIVERY DETAILS</div><h2>Saved addresses</h2>
      {addresses.length ? <div className="account-address-grid">{addresses.map((address) => <article className="account-address" key={address.id}>
        {address.is_default_shipping && <span className="admin-status status-active">DEFAULT SHIPPING</span>}
        <strong>{address.recipient_name}</strong><p>{address.address_line_1}{address.address_line_2 ? ", " + address.address_line_2 : ""}<br/>{address.city}{address.region ? ", " + address.region : ""} {address.postal_code}<br/>{address.country_code}</p>
      </article>)}</div> : <div className="empty-note">No delivery addresses have been saved yet. Addresses can be added during the secure checkout setup.</div>}
    </section>
    <section className="account-section">
      <div className="section-kicker">ORDER HISTORY</div><h2>Your orders</h2>
      {orders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>DATE</th><th>STATUS</th><th>TOTAL</th><th>TRACKING</th></tr></thead><tbody>
        {orders.map((order) => <tr key={order.id}><td><Link href={"/account/orders/" + order.id}>{order.order_number}</Link></td><td>{new Date(order.created_at).toLocaleDateString("en-IN")}</td><td><span className={"admin-status status-" + order.status}>{order.status.replaceAll("_", " ")}</span></td><td>{formatMoneyFromMinor(order.total_minor, order.currency)}</td><td>{safeTrackingUrl(order.tracking_url) ? <a href={safeTrackingUrl(order.tracking_url) ?? undefined} target="_blank" rel="noreferrer">{order.tracking_carrier || "Track parcel"}</a> : order.tracking_number || "—"}</td></tr>)}
      </tbody></table></div> : <div className="empty-note">Your completed orders will appear here. The gallery has not received an online order through this website yet.</div>}
    </section>
  </div>;
}
