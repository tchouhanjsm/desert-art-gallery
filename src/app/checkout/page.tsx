import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/CheckoutForm";
import { getCurrentCustomer, isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";
import { listCustomerAddresses } from "@/server/customer/repository";
import { listMySqlCheckoutConfiguration } from "@/server/checkout/mysql-orders";

export const metadata = {
  title: "配送先・ご注文内容の確認",
  description: "配送先を入力し、お支払い前の注文内容をご確認ください。",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  if (isMySqlCustomerAuthEnabled()) {
    const customer = await getCurrentCustomer();
    if (!customer) redirect("/login?next=%2Fcheckout");
    const [addressRows, configuration] = await Promise.all([
      listCustomerAddresses(customer.id),
      listMySqlCheckoutConfiguration(),
    ]);
    const addresses = addressRows.map((address) => ({
      id: address.id,
      recipient_name: address.recipientName,
      address_line_1: address.addressLine1,
      address_line_2: address.addressLine2,
      city: address.city,
      region: address.region,
      postal_code: address.postalCode,
      country_code: address.countryCode,
      phone: address.phone,
      is_default_shipping: address.isDefaultShipping,
    }));
    const zones = configuration.zones.filter((zone) => zone.isActive).map((zone) => ({
      id: zone.id, name: zone.name, country_codes: zone.countryCodes,
    }));
    const rates = configuration.rates.filter((rate) => rate.isActive).map((rate) => ({
      id: rate.id, zone_id: rate.zoneId, name: rate.name, currency: rate.currency,
      amount_minor: rate.amountMinor, min_delivery_days: rate.minDeliveryDays,
      max_delivery_days: rate.maxDeliveryDays, duties_disclosure: rate.dutiesDisclosure,
    }));
    const taxRules = configuration.taxes.filter((rule) => rule.isActive).map((rule) => ({
      id: rule.id, country_code: rule.countryCode, currency: rule.currency,
      tax_name: rule.taxName, rate_basis_points: rule.rateBasisPoints,
      taxable_shipping: rule.taxableShipping, disclosure: rule.disclosure,
    }));
    return <div className="page-shell">
      <div className="page-heading"><div className="section-kicker">ご注文内容の確認</div><h1>配送先情報</h1><p>設定済みの配送方法を選択し、お届け先に関する案内をご確認ください。</p></div>
      <CheckoutForm addresses={addresses} zones={zones} rates={rates} taxRules={taxRules}/>
    </div>;
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell"><div className="page-heading"><div className="section-kicker">SECURE ご注文内容の確認</div><h1>配送先情報</h1><p>注文手続きの設定が完了していません。注文や決済は作成されていません。</p></div><Link className="text-link" href="/cart">カートに戻る</Link></div>;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=%2Fcheckout");

  const [addresses, zones, rates, taxRules] = await Promise.all([
    supabase.from("addresses")
      .select("id,recipient_name,address_line_1,address_line_2,city,region,postal_code,country_code,phone,is_default_shipping")
      .eq("user_id", user.id)
      .order("is_default_shipping", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("shipping_zones").select("id,name,country_codes").eq("is_active", true),
    supabase.from("shipping_rates").select("id,zone_id,name,currency,amount_minor,min_delivery_days,max_delivery_days,duties_disclosure").eq("is_active", true),
    supabase.from("checkout_tax_rules").select("id,country_code,currency,tax_name,rate_basis_points,taxable_shipping,disclosure").eq("is_active", true),
  ]);

  if (addresses.error || zones.error || rates.error || taxRules.error) {
    return <div className="page-shell"><div className="page-heading"><div className="section-kicker">ご注文内容の確認</div><h1>配送先情報</h1><p>注文手続きの設定が完了していません。注文や決済は作成されていません。</p></div><div className="checkout-notice" role="status">注文案を作成する前に、お届け先ごとの送料・税金・関税等の案内設定と確認が必要です。</div><Link className="text-link" href="/cart">カートに戻る</Link></div>;
  }

  const savedAddresses = (addresses.data ?? []).map((address) => ({
    ...address, address_line_2: address.address_line_2 ?? "", region: address.region ?? "", phone: address.phone ?? "",
  }));

  return <div className="page-shell">
    <div className="page-heading"><div className="section-kicker">ご注文内容の確認</div><h1>配送先情報</h1><p>設定済みの配送方法を選択し、お届け先に関する案内をご確認ください。</p></div>
    <CheckoutForm
      addresses={savedAddresses}
      zones={zones.data ?? []}
      rates={rates.data ?? []}
      taxRules={taxRules.data ?? []}
    />
  </div>;
}
