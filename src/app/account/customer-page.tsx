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
    draft: "注文案",
    pending_payment: "お支払い待ち",
    paid: "お支払い済み",
    processing: "準備中",
    shipped: "発送済み",
    delivered: "お届け済み",
    cancelled: "キャンセル",
    refunded: "返金済み",
    expired: "期限切れ",
  };
  return labels[status] ?? "注文状況を確認中";
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
        <div><div className="section-kicker">マイアカウント</div><h1>ようこそ、{customer.displayName}さん</h1><p>プロフィールと配送先住所を管理できます。</p></div>
        <form action={signOutLocalCustomer}><button className="button-outline" type="submit">ログアウト</button></form>
      </div>
      <section className="account-section">
        <div className="section-kicker">お客様情報</div><h2>プロフィール</h2>
        <form action={updateLocalCustomerProfile} className="account-profile-form">
          <label>お名前<input name="display_name" defaultValue={customer.displayName} minLength={2} maxLength={160} required /></label>
          <label>メールアドレス<input value={customer.email} readOnly aria-readonly="true" /></label>
          <label>電話番号<input name="phone" defaultValue={customer.phone} maxLength={40} /></label>
          <button className="button-primary dark-button" type="submit">変更を保存</button>
        </form>
      </section>
      <section className="account-section">
        <div className="section-kicker">配送先情報</div><h2>保存済みの住所</h2>
        {addresses.length ? <div className="account-address-grid">{addresses.map((address) => (
          <article className="account-address" key={address.id}>
            {address.isDefaultShipping && <span className="admin-status status-active">既定の配送先</span>}
            <strong>{address.recipientName}</strong>
            <p>{address.addressLine1}{address.addressLine2 ? ", " + address.addressLine2 : ""}<br />{address.city}{address.region ? ", " + address.region : ""} {address.postalCode}<br />{address.countryCode}</p>
            <details className="address-edit"><summary>住所を編集</summary><form action={saveLocalCustomerAddress} className="address-form">
              <input type="hidden" name="id" value={address.id} />
              <label>宛名<input name="recipient_name" defaultValue={address.recipientName} required maxLength={160} /></label>
              <label>住所（番地・通り名）<input name="address_line_1" defaultValue={address.addressLine1} required maxLength={240} /></label>
              <label>建物名・部屋番号など<input name="address_line_2" defaultValue={address.addressLine2} maxLength={240} /></label>
              <label>市区町村<input name="city" defaultValue={address.city} required maxLength={120} /></label>
              <label>都道府県・州・地域<input name="region" defaultValue={address.region} maxLength={120} /></label>
              <label>郵便番号<input name="postal_code" defaultValue={address.postalCode} required maxLength={24} /></label>
              <label>国コード<input name="country_code" defaultValue={address.countryCode} required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" /></label>
              <label>電話番号<input name="phone" defaultValue={address.phone} maxLength={40} /></label>
              <label className="address-default"><input type="checkbox" name="is_default_shipping" value="yes" defaultChecked={address.isDefaultShipping} /> 既定の配送先にする</label>
              <button type="submit" className="button-outline">住所を保存</button>
            </form></details>
            <form action={deleteLocalCustomerAddress}><input type="hidden" name="id" value={address.id} /><button type="submit" className="address-delete">住所を削除</button></form>
          </article>
        ))}</div> : <div className="empty-note">配送先住所はまだ登録されていません。下記から追加してください。</div>}
        <details className="address-add"><summary>配送先住所を追加</summary><form action={saveLocalCustomerAddress} className="address-form">
          <label>宛名<input name="recipient_name" required maxLength={160} /></label>
          <label>住所（番地・通り名）<input name="address_line_1" required maxLength={240} /></label>
          <label>建物名・部屋番号など<input name="address_line_2" maxLength={240} /></label>
          <label>市区町村<input name="city" required maxLength={120} /></label>
          <label>都道府県・州・地域<input name="region" maxLength={120} /></label>
          <label>郵便番号<input name="postal_code" required maxLength={24} /></label>
          <label>国コード<input name="country_code" placeholder="例：JP、IN、US" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" /></label>
          <label>電話番号<input name="phone" maxLength={40} /></label>
          <label className="address-default"><input type="checkbox" name="is_default_shipping" value="yes" /> 既定の配送先にする</label>
          <button type="submit" className="button-primary dark-button">住所を保存</button>
        </form></details>
      </section>
      <section className="account-section">
        <div className="section-kicker">注文履歴</div><h2>ご注文</h2>
        {savedOrders.length ? <div className="account-order-list">{savedOrders.map((order) => (
          <article className="account-order-row" key={order.id}>
            <div><strong><Link href={"/account/orders/" + order.id}>{order.orderNumber}</Link></strong><p>{new Date(order.createdAt).toLocaleDateString("ja-JP")} · {formatOrderStatus(order.status)}</p></div>
            <strong>{formatMoneyFromMinor(order.totalMinor, order.currency)}</strong>
          </article>
        ))}</div> : <div className="empty-note">このアカウントで作成された注文はありません。</div>}
        <div className="checkout-notice">このMySQLアカウントで作成された注文のみ表示しています。以前のアカウントシステムの注文履歴は移行されていません。決済機能は無効です。</div>
        <Link className="text-link" href="/shop">商品を探す</Link>
      </section>
    </div>
  );
}
