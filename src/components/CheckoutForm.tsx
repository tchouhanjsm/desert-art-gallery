"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { formatMoneyFromMinor } from "@/lib/money";
import type { CheckoutAddress } from "@/lib/checkout";

type SavedAddress = CheckoutAddress & { id: string; is_default_shipping: boolean };
type ShippingZone = { id: string; name: string; country_codes: string[] };
type ShippingRate = {
  id: string; zone_id: string; name: string; currency: string; amount_minor: number;
  min_delivery_days: number | null; max_delivery_days: number | null; duties_disclosure: string | null;
};
type TaxRule = {
  id: string; country_code: string; currency: string; tax_name: string;
  rate_basis_points: number; taxable_shipping: boolean; disclosure: string;
};

const emptyAddress: CheckoutAddress = {
  recipient_name: "", address_line_1: "", city: "", postal_code: "", country_code: "",
};

export function CheckoutForm({
  addresses, zones, rates, taxRules,
}: {
  addresses: SavedAddress[]; zones: ShippingZone[]; rates: ShippingRate[]; taxRules: TaxRule[];
}) {
  const router = useRouter();
  const { lines, preview, isLoading, error: cartError } = useCart();
  const [address, setAddress] = useState<CheckoutAddress>(addresses[0] ?? emptyAddress);
  const [customerNote, setCustomerNote] = useState("");
  const [shippingRateId, setShippingRateId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [holdExpiry, setHoldExpiry] = useState("");
  const reservationKey = useRef<{ fingerprint: string; key: string } | null>(null);

  const currencies = [...new Set(preview.map((item) => item.currency).filter((value): value is string => Boolean(value)))];
  const currency = currencies.length === 1 ? currencies[0] : null;
  const matchingZones = useMemo(() => zones.filter((zone) =>
    zone.country_codes.map((code) => code.toUpperCase()).includes(address.country_code.toUpperCase()),
  ), [zones, address.country_code]);
  const matchingZoneIds = useMemo(() => new Set(matchingZones.map((zone) => zone.id)), [matchingZones]);
  const matchingRates = useMemo(() => matchingZones.length === 1 ? rates.filter((rate) =>
    matchingZoneIds.has(rate.zone_id) && rate.currency === currency && Boolean(rate.duties_disclosure?.trim()),
  ) : [], [rates, matchingZones.length, matchingZoneIds, currency]);
  const matchingTaxRules = useMemo(() => taxRules.filter((rule) =>
    rule.country_code === address.country_code.toUpperCase() && rule.currency === currency,
  ), [taxRules, address.country_code, currency]);
  const effectiveRateId = matchingRates.some((rate) => rate.id === shippingRateId) ? shippingRateId : "";
  const selectedRate = matchingRates.find((rate) => rate.id === effectiveRateId) ?? null;
  const readyLines = lines.length > 0 && preview.length === lines.length
    && preview.every((item) => item.available && item.priceMinor !== null && item.currency === currency);
  const canPrepare = readyLines && !isLoading && !cartError && Boolean(currency)
    && Boolean(selectedRate) && matchingTaxRules.length > 0;

  function updateAddress(field: keyof CheckoutAddress, value: string) {
    setAddress((current) => ({ ...current, [field]: field === "country_code" ? value.toUpperCase().slice(0, 2) : value }));
  }

  function selectSavedAddress(id: string) {
    if (!id) { setAddress(emptyAddress); return; }
    const saved = addresses.find((item) => item.id === id);
    if (saved) setAddress({
      recipient_name: saved.recipient_name,
      address_line_1: saved.address_line_1,
      ...(saved.address_line_2 ? { address_line_2: saved.address_line_2 } : {}),
      city: saved.city,
      ...(saved.region ? { region: saved.region } : {}),
      postal_code: saved.postal_code,
      country_code: saved.country_code,
      ...(saved.phone ? { phone: saved.phone } : {}),
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPrepare || !selectedRate || !currency) return;
    setBusy(true);
    setMessage("");
    setHoldExpiry("");
    try {
      const fingerprint = JSON.stringify({ lines, address, shippingRateId: selectedRate.id, customerNote });
      if (!reservationKey.current || reservationKey.current.fingerprint !== fingerprint) {
        reservationKey.current = { fingerprint, key: crypto.randomUUID() };
      }
      const reserveResponse = await fetch("/api/cart/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": reservationKey.current.key },
        body: JSON.stringify({ lines }),
        cache: "no-store",
      });
      const reservation = await reserveResponse.json();
      if (!reserveResponse.ok || typeof reservation.reservation_id !== "string") {
        if (reserveResponse.status === 409) reservationKey.current = null;
        throw new Error(reservation.error || "在庫を確保できませんでした。カートを更新してもう一度お試しください。");
      }
      if (typeof reservation.expires_at === "string") setHoldExpiry(reservation.expires_at);

      const response = await fetch("/api/checkout/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: reservation.reservation_id,
          shippingRateId: selectedRate.id,
          idempotencyKey: crypto.randomUUID(),
          shippingAddress: address,
          customerNote,
        }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || typeof result.order_id !== "string") {
        throw new Error(result.error || "注文案を作成できませんでした。");
      }
      router.push("/account/orders/" + result.order_id);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "注文案を作成できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  if (!lines.length) return <div className="empty-note">カートは空です。 <Link href="/shop" className="empty-link">商品を見る</Link></div>;

  return <div className="checkout-layout">
    <form className="checkout-form" onSubmit={handleSubmit}>
      {addresses.length > 0 && <label className="checkout-saved-address">保存済みの配送先を使う
        <select defaultValue={addresses[0]?.id ?? ""} onChange={(event) => selectSavedAddress(event.target.value)}>
          {addresses.map((saved) => <option key={saved.id} value={saved.id}>{saved.recipient_name} — {saved.city}, {saved.country_code}</option>)}
          <option value="">別の住所を入力する</option>
        </select>
      </label>}
      <section className="checkout-section">
        <div className="section-kicker">01 / お届け先</div>
        <h2>お届け先を入力してください</h2>
        <div className="checkout-fields">
          <label>郵便番号<input required maxLength={24} autoComplete="postal-code" value={address.postal_code} onChange={(event) => updateAddress("postal_code", event.target.value)}/></label>
          <label>国コード<input required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" autoComplete="country" placeholder="2文字の国コード（例：JP）" value={address.country_code} onChange={(event) => updateAddress("country_code", event.target.value)}/></label>
          <label>都道府県・州・地域<input maxLength={120} autoComplete="address-level1" value={address.region ?? ""} onChange={(event) => updateAddress("region", event.target.value)}/></label>
          <label>市区町村<input required maxLength={120} autoComplete="address-level2" value={address.city} onChange={(event) => updateAddress("city", event.target.value)}/></label>
          <label>住所（番地・通り名）<input required maxLength={240} autoComplete="address-line1" value={address.address_line_1} onChange={(event) => updateAddress("address_line_1", event.target.value)}/></label>
          <label>建物名・部屋番号など<input maxLength={240} autoComplete="address-line2" value={address.address_line_2 ?? ""} onChange={(event) => updateAddress("address_line_2", event.target.value)}/></label>
          <label>お名前<input required maxLength={160} autoComplete="name" value={address.recipient_name} onChange={(event) => updateAddress("recipient_name", event.target.value)}/></label>
          <label>電話番号<input maxLength={40} autoComplete="tel" value={address.phone ?? ""} onChange={(event) => updateAddress("phone", event.target.value)}/></label>
        </div>
      </section>

      <section className="checkout-section">
        <div className="section-kicker">02 / 配送方法</div>
        <h2>利用可能な配送方法</h2>
        {!currency && <p className="checkout-blocker">ご注文を続けるには、カート内の商品価格が同一通貨である必要があります。</p>}
        {matchingZones.length > 1 && <p className="checkout-blocker">この国に複数の配送地域が設定されています。設定が整理されるまで注文手続きはできません。</p>}
        {currency && matchingZones.length === 0 && <p className="checkout-blocker">このお届け先を対象とする配送地域が設定されていません（{address.country_code || "このお届け先"}. 未確認の送料や配送日数は表示しません。</p>}
        {currency && matchingZones.length === 1 && matchingRates.length === 0 && <p className="checkout-blocker">承認済みの送料設定がありません（{address.country_code || "このお届け先"} in {currency}. 未確認の送料や配送日数は表示しません。</p>}
        {matchingRates.length > 0 && <label>配送方法
          <select value={effectiveRateId} onChange={(event) => setShippingRateId(event.target.value)} required>
            <option value="" disabled>配送方法を選択してください</option>
            {matchingRates.map((rate) => <option key={rate.id} value={rate.id}>{rate.name} — {formatMoneyFromMinor(rate.amount_minor, rate.currency)}</option>)}
          </select>
        </label>}
        {selectedRate && <div className="checkout-disclosure">
          <strong>{selectedRate.name}</strong>
          {selectedRate.min_delivery_days !== null && selectedRate.max_delivery_days !== null
            ? <p>設定済みのお届け目安：{selectedRate.min_delivery_days}–{selectedRate.max_delivery_days}日</p>
            : <p>この配送方法のお届け目安は未設定です。</p>}
          <p>{selectedRate.duties_disclosure}</p>
        </div>}
      </section>

      <section className="checkout-section">
        <div className="section-kicker">03 / 税金・関税等</div>
        <h2>お届け先に関するご案内</h2>
        {!currency || matchingTaxRules.length === 0
          ? <p className="checkout-blocker">この国・通貨に適用する承認済みの税設定がありません。事業者が適用ルール（税率0%を含む）を登録するまで注文手続きはできません。</p>
          : matchingTaxRules.map((rule) => <div className="checkout-disclosure" key={rule.id}><strong>{rule.tax_name}</strong><p>{rule.disclosure}</p></div>)}
      </section>

      <section className="checkout-section">
        <div className="section-kicker">04 / ご注文メモ</div>
        <label>配送に関するメモ（任意）<textarea maxLength={1000} rows={3} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)}/></label>
      </section>
      {cartError && <p className="checkout-error" role="alert">{cartError}</p>}
      {message && <p className="checkout-error" role="alert">{message}</p>}
      {holdExpiry && <p className="checkout-blocker" role="status">在庫は一時確保されています（期限：{new Date(holdExpiry).toLocaleString("ja-JP")}）。注文案が作成されない場合、設定済みの処理により確保が解除されます。</p>}
      <div className="checkout-notice" role="note">この操作では、お支払い前の注文案のみを作成します。決済は行われません。注文案と一時的な在庫確保には有効期限があります。決済は、決済事業者とWebhookの検証完了後にのみ有効化されます。</div>
      <button className="button-primary dark-button" type="submit" disabled={!canPrepare || busy}>{busy ? "注文案を作成しています…" : "お支払い前の注文案を作成する"}</button>
    </form>
    <aside className="cart-summary checkout-summary">
      <div className="section-kicker">カートの商品</div><h2>ご注文内容</h2>
      {preview.map((item) => <div className="cart-summary-row" key={item.slug + "::" + (item.variantId ?? "")}><span>{item.name}{item.variantLabel ? " · " + item.variantLabel : ""} × {item.quantityRequested}</span><strong>{item.priceMinor !== null && item.currency ? formatMoneyFromMinor(item.priceMinor * item.quantityRequested, item.currency) : "ご利用いただけません"}</strong></div>)}
      <p>商品価格は現在のカタログ情報から再確認されます。送料と設定済みの税金は、注文案作成前にサーバー側で再計算されます。</p>
      {currency && <p>通貨： <strong>{currency}</strong></p>}
      {isLoading && <p className="cart-state">在庫状況を確認しています…</p>}
    </aside>
  </div>;
}
