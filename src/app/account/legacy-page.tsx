import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoneyFromMinor } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteAddress, saveAddress, signOutCustomer, updateProfile } from "./actions";

export const metadata = { title: "マイアカウント", robots: { index: false, follow: false } };

type OrderRow = { id: string; order_number: string; status: string; currency: string; total_minor: number; created_at: string; tracking_carrier: string | null; tracking_number: string | null; tracking_url: string | null };
type AddressRow = { id: string; recipient_name: string; address_line_1: string; address_line_2: string | null; city: string; region: string | null; postal_code: string; country_code: string; is_default_shipping: boolean };

function formatLegacyOrderStatus(status: string) {
  const labels: Record<string, string> = {
    draft: "注文案", pending_payment: "お支払い待ち", paid: "お支払い済み",
    processing: "準備中", shipped: "発送済み", delivered: "お届け済み",
    cancelled: "キャンセル", refunded: "返金済み", expired: "期限切れ",
  };
  return labels[status] ?? "注文状況を確認中";
}

function safeTrackingUrl(value: string | null) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null; } catch { return null; }
}

export async function LegacyAccountPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell"><div className="page-heading"><div className="section-kicker">お客様アカウント</div><h1>マイアカウント</h1><p>データベース接続の設定が完了すると、アカウント機能をご利用いただけます。</p></div><div className="empty-note"><Link href="/contact">お問い合わせ</Link> 既存のご注文についてサポートが必要な場合はご連絡ください。</div></div>;
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
    <div className="admin-page-heading"><div><div className="section-kicker">マイアカウント</div><h1>ようこそ{profile?.full_name ? ", " + profile.full_name : ""}</h1><p>お客様情報、配送先住所、ご注文を管理できます。</p></div><form action={signOutCustomer}><button className="button-outline" type="submit">ログアウト</button></form></div>
    <section className="account-section">
      <div className="section-kicker">お客様情報</div><h2>プロフィール</h2>
      <form action={updateProfile} className="account-profile-form">
        <label>お名前<input name="full_name" defaultValue={profile?.full_name ?? ""} maxLength={160} required /></label>
        <label>メールアドレス<input value={user.email ?? ""} readOnly aria-readonly="true" /></label>
        <label>電話番号<input name="phone" defaultValue={profile?.phone ?? ""} maxLength={40} /></label>
        <button className="button-primary dark-button" type="submit">変更を保存</button>
      </form>
    </section>
    <section className="account-section">
      <div className="section-kicker">配送先情報</div><h2>保存済みの住所</h2>
      {addresses.length ? <div className="account-address-grid">{addresses.map((address) => <article className="account-address" key={address.id}>
        {address.is_default_shipping && <span className="admin-status status-active">既定の配送先</span>}
        <strong>{address.recipient_name}</strong><p>{address.address_line_1}{address.address_line_2 ? ", " + address.address_line_2 : ""}<br/>{address.city}{address.region ? ", " + address.region : ""} {address.postal_code}<br/>{address.country_code}</p>
        <details className="address-edit"><summary>住所を編集</summary><form action={saveAddress} className="address-form">
          <input type="hidden" name="id" value={address.id} />
          <label>宛名<input name="recipient_name" defaultValue={address.recipient_name} required maxLength={160}/></label>
          <label>住所（番地・通り名）<input name="address_line_1" defaultValue={address.address_line_1} required maxLength={240}/></label>
          <label>建物名・部屋番号など<input name="address_line_2" defaultValue={address.address_line_2 ?? ""} maxLength={240}/></label>
          <label>市区町村<input name="city" defaultValue={address.city} required maxLength={120}/></label>
          <label>都道府県・州・地域<input name="region" defaultValue={address.region ?? ""} maxLength={120}/></label>
          <label>郵便番号<input name="postal_code" defaultValue={address.postal_code} required maxLength={24}/></label>
          <label>国コード<input name="country_code" defaultValue={address.country_code} required minLength={2} maxLength={2} pattern="[A-Za-z]{2}"/></label>
          <label>電話番号<input name="phone" maxLength={40}/></label>
          <label className="address-default"><input type="checkbox" name="is_default_shipping" value="yes" defaultChecked={address.is_default_shipping}/> 既定の配送先にする</label>
          <button type="submit" className="button-outline">住所を保存</button>
        </form></details>
        <form action={deleteAddress}><input type="hidden" name="id" value={address.id}/><button type="submit" className="address-delete">住所を削除</button></form>
      </article>)}</div> : <div className="empty-note">配送先住所はまだ登録されていません。下記から追加してください。</div>}
      <details className="address-add"><summary>配送先住所を追加</summary><form action={saveAddress} className="address-form">
        <label>宛名<input name="recipient_name" required maxLength={160}/></label>
        <label>住所（番地・通り名）<input name="address_line_1" required maxLength={240}/></label>
        <label>建物名・部屋番号など<input name="address_line_2" maxLength={240}/></label>
        <label>市区町村<input name="city" required maxLength={120}/></label>
        <label>都道府県・州・地域<input name="region" maxLength={120}/></label>
        <label>郵便番号<input name="postal_code" required maxLength={24}/></label>
        <label>国コード<input name="country_code" placeholder="IN, US, GB…" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}"/></label>
        <label>電話番号<input name="phone" maxLength={40}/></label>
        <label className="address-default"><input type="checkbox" name="is_default_shipping" value="yes"/> 既定の配送先にする</label>
        <button type="submit" className="button-primary dark-button">住所を保存</button>
      </form></details>
    </section>
    <section className="account-section">
      <div className="section-kicker">注文履歴</div><h2>ご注文</h2>
      {orders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>注文番号</th><th>日付</th><th>状況</th><th>合計</th><th>追跡</th></tr></thead><tbody>
        {orders.map((order) => <tr key={order.id}><td><Link href={"/account/orders/" + order.id}>{order.order_number}</Link></td><td>{new Date(order.created_at).toLocaleDateString("ja-JP")}</td><td><span className={"admin-status status-" + order.status}>{formatLegacyOrderStatus(order.status)}</span></td><td>{formatMoneyFromMinor(order.total_minor, order.currency)}</td><td>{safeTrackingUrl(order.tracking_url) ? <a href={safeTrackingUrl(order.tracking_url) ?? undefined} target="_blank" rel="noreferrer">{order.tracking_carrier || "配送状況を確認"}</a> : order.tracking_number || "—"}</td></tr>)}
      </tbody></table></div> : <div className="empty-note">このウェブサイトでの注文履歴はまだありません。</div>}
    </section>
  </div>;
}
