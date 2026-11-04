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

function formatOrderStatus(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    pending_payment: "Awaiting payment",
    paid: "Paid",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
    expired: "Expired",
  };
  return labels[status] ?? "Status pending";
}

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
        <div><div className="section-kicker">MY ACCOUNT</div><h1>Welcome, {customer.displayName}</h1><p>Manage your profile and delivery addresses.</p></div>
        <form action={signOutLocalCustomer}><button className="button-outline" type="submit">Sign out</button></form>
      </div>
      <section className="account-section">
        <div className="section-kicker">YOUR DETAILS</div><h2>Profile</h2>
        <form action={updateLocalCustomerProfile} className="account-profile-form">
          <label>Full name<input name="display_name" defaultValue={customer.displayName} minLength={2} maxLength={160} required /></label>
          <label>Email address<input value={customer.email} readOnly aria-readonly="true" /></label>
          <label>Phone number<input name="phone" defaultValue={customer.phone} maxLength={40} /></label>
          <button className="button-primary dark-button" type="submit">Save changes</button>
        </form>
      </section>
      <section className="account-section">
        <div className="section-kicker">DELIVERY DETAILS</div><h2>Saved addresses</h2>
        {addresses.length ? <div className="account-address-grid">{addresses.map((address) => (
          <article className="account-address" key={address.id}>
            {address.isDefaultShipping && <span className="admin-status status-active">Default delivery address</span>}
            <strong>{address.recipientName}</strong>
            <p>{address.addressLine1}{address.addressLine2 ? ", " + address.addressLine2 : ""}<br />{address.city}{address.region ? ", " + address.region : ""} {address.postalCode}<br />{address.countryCode}</p>
            <details className="address-edit"><summary>Edit address</summary><form action={saveLocalCustomerAddress} className="address-form">
              <input type="hidden" name="id" value={address.id} />
              <label>Recipient name<input name="recipient_name" defaultValue={address.recipientName} required maxLength={160} /></label>
              <label>Address line 1<input name="address_line_1" defaultValue={address.addressLine1} required maxLength={240} /></label>
              <label>Building, apartment or suite<input name="address_line_2" defaultValue={address.addressLine2} maxLength={240} /></label>
              <label>City<input name="city" defaultValue={address.city} required maxLength={120} /></label>
              <label>State / region<input name="region" defaultValue={address.region} maxLength={120} /></label>
              <label>Postal code<input name="postal_code" defaultValue={address.postalCode} required maxLength={24} /></label>
              <label>Country code<input name="country_code" defaultValue={address.countryCode} required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" /></label>
              <label>Phone number<input name="phone" defaultValue={address.phone} maxLength={40} /></label>
              <label className="address-default"><input type="checkbox" name="is_default_shipping" value="yes" defaultChecked={address.isDefaultShipping} /> Make this the default delivery address</label>
              <button type="submit" className="button-outline">Save address</button>
            </form></details>
            <form action={deleteLocalCustomerAddress}><input type="hidden" name="id" value={address.id} /><button type="submit" className="address-delete">Delete address</button></form>
          </article>
        ))}</div> : <div className="empty-note">No delivery addresses have been saved yet. Add one below.</div>}
        <details className="address-add"><summary>Add a delivery address</summary><form action={saveLocalCustomerAddress} className="address-form">
          <label>Recipient name<input name="recipient_name" required maxLength={160} /></label>
          <label>Address line 1<input name="address_line_1" required maxLength={240} /></label>
          <label>Building, apartment or suite<input name="address_line_2" maxLength={240} /></label>
          <label>City<input name="city" required maxLength={120} /></label>
          <label>State / region<input name="region" maxLength={120} /></label>
          <label>Postal code<input name="postal_code" required maxLength={24} /></label>
          <label>Country code<input name="country_code" placeholder="e.g. IN, US or JP" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" /></label>
          <label>Phone number<input name="phone" maxLength={40} /></label>
          <label className="address-default"><input type="checkbox" name="is_default_shipping" value="yes" /> Make this the default delivery address</label>
          <button type="submit" className="button-primary dark-button">Save address</button>
        </form></details>
      </section>
      <section className="account-section">
        <div className="section-kicker">ORDER HISTORY</div><h2>Orders</h2>
        {savedOrders.length ? <div className="account-order-list">{savedOrders.map((order) => (
          <article className="account-order-row" key={order.id}>
            <div><strong><Link href={"/account/orders/" + order.id}>{order.orderNumber}</Link></strong><p>{new Date(order.createdAt).toLocaleDateString("en-IN")} · {formatOrderStatus(order.status)}</p></div>
            <strong>{formatMoneyFromMinor(order.totalMinor, order.currency)}</strong>
          </article>
        ))}</div> : <div className="empty-note">There are no orders on this account yet.</div>}
        <div className="checkout-notice">Only orders created under this MySQL account are shown. Order history from the previous account system has not been migrated. Payments are disabled.</div>
        <Link className="text-link" href="/shop">Explore the collection</Link>
      </section>
    </div>
  );
}
