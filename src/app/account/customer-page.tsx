import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/server/auth/local-customer";
import { listCustomerAddresses } from "@/server/customer/repository";
import { listMySqlCustomerOrders } from "@/server/checkout/mysql-orders";
import { formatMoneyFromMinor } from "@/lib/money";
import {
  deleteLocalCustomerAddress,
  saveLocalCustomerAddress,
  signOutLocalCustomer,
  updateLocalCustomerProfile,
} from "./mysql-actions";

export async function CustomerAccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");
  const [addresses, savedOrders] = await Promise.all([
    listCustomerAddresses(customer.id),
    listMySqlCustomerOrders(customer.id),
  ]);

  return (
    <div className="page-shell account-shell">
      <div className="admin-page-heading">
        <div><div className="section-kicker">YOUR DESERT ART GALLERY</div><h1>Welcome, {customer.displayName}</h1><p>Manage your profile and saved delivery addresses.</p></div>
        <form action={signOutLocalCustomer}><button className="button-outline" type="submit">SIGN OUT</button></form>
      </div>
      <section className="account-section">
        <div className="section-kicker">PERSONAL DETAILS</div><h2>Your profile</h2>
        <form action={updateLocalCustomerProfile} className="account-profile-form">
          <label>Full name<input name="display_name" defaultValue={customer.displayName} minLength={2} maxLength={160} required /></label>
          <label>Email address<input value={customer.email} readOnly aria-readonly="true" /></label>
          <label>Phone number<input name="phone" defaultValue={customer.phone} maxLength={40} /></label>
          <button className="button-primary dark-button" type="submit">SAVE DETAILS</button>
        </form>
      </section>
      <section className="account-section">
        <div className="section-kicker">DELIVERY DETAILS</div><h2>Saved addresses</h2>
        {addresses.length ? <div className="account-address-grid">{addresses.map((address) => (
          <article className="account-address" key={address.id}>
            {address.isDefaultShipping && <span className="admin-status status-active">DEFAULT SHIPPING</span>}
            <strong>{address.recipientName}</strong>
            <p>{address.addressLine1}{address.addressLine2 ? ", " + address.addressLine2 : ""}<br />{address.city}{address.region ? ", " + address.region : ""} {address.postalCode}<br />{address.countryCode}</p>
            <details className="address-edit"><summary>EDIT ADDRESS</summary><form action={saveLocalCustomerAddress} className="address-form">
              <input type="hidden" name="id" value={address.id} />
              <label>Recipient<input name="recipient_name" defaultValue={address.recipientName} required maxLength={160} /></label>
              <label>Address line 1<input name="address_line_1" defaultValue={address.addressLine1} required maxLength={240} /></label>
              <label>Address line 2<input name="address_line_2" defaultValue={address.addressLine2} maxLength={240} /></label>
              <label>City<input name="city" defaultValue={address.city} required maxLength={120} /></label>
              <label>State / region<input name="region" defaultValue={address.region} maxLength={120} /></label>
              <label>Postal code<input name="postal_code" defaultValue={address.postalCode} required maxLength={24} /></label>
              <label>Country code<input name="country_code" defaultValue={address.countryCode} required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" /></label>
              <label>Phone<input name="phone" defaultValue={address.phone} maxLength={40} /></label>
              <label className="address-default"><input type="checkbox" name="is_default_shipping" value="yes" defaultChecked={address.isDefaultShipping} /> Default shipping address</label>
              <button type="submit" className="button-outline">SAVE ADDRESS</button>
            </form></details>
            <form action={deleteLocalCustomerAddress}><input type="hidden" name="id" value={address.id} /><button type="submit" className="address-delete">DELETE ADDRESS</button></form>
          </article>
        ))}</div> : <div className="empty-note">No delivery addresses have been saved yet. Add one below.</div>}
        <details className="address-add"><summary>ADD A DELIVERY ADDRESS</summary><form action={saveLocalCustomerAddress} className="address-form">
          <label>Recipient<input name="recipient_name" required maxLength={160} /></label>
          <label>Address line 1<input name="address_line_1" required maxLength={240} /></label>
          <label>Address line 2<input name="address_line_2" maxLength={240} /></label>
          <label>City<input name="city" required maxLength={120} /></label>
          <label>State / region<input name="region" maxLength={120} /></label>
          <label>Postal code<input name="postal_code" required maxLength={24} /></label>
          <label>Country code<input name="country_code" placeholder="IN, US, GB…" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" /></label>
          <label>Phone<input name="phone" maxLength={40} /></label>
          <label className="address-default"><input type="checkbox" name="is_default_shipping" value="yes" /> Default shipping address</label>
          <button type="submit" className="button-primary dark-button">SAVE ADDRESS</button>
        </form></details>
      </section>
      <section className="account-section">
        <div className="section-kicker">ORDER HISTORY</div><h2>Your orders</h2>
        {savedOrders.length ? <div className="account-order-list">{savedOrders.map((order) => (
          <article className="account-order-row" key={order.id}>
            <div><strong><Link href={"/account/orders/" + order.id}>{order.orderNumber}</Link></strong><p>{new Date(order.createdAt).toLocaleDateString("en-IN")} · {order.status.replaceAll("_", " ")}</p></div>
            <strong>{formatMoneyFromMinor(order.totalMinor, order.currency)}</strong>
          </article>
        ))}</div> : <div className="empty-note">No orders have been prepared from this account yet.</div>}
        <div className="checkout-notice">Only orders created in this MySQL account are displayed. Existing customer orders from the previous identity system have not been imported. Payment remains disabled.</div>
        <Link className="text-link" href="/shop">CONTINUE DISCOVERING</Link>
      </section>
    </div>
  );
}
