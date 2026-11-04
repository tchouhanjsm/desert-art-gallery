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
        throw new Error(reservation.error || "We could not reserve the requested stock. Refresh your cart and try again.");
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
        throw new Error(result.error || "We could not create the order draft.");
      }
      router.push("/account/orders/" + result.order_id);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "We could not create the order draft.");
    } finally {
      setBusy(false);
    }
  }

  if (!lines.length) return <div className="empty-note">Your cart is empty. <Link href="/shop" className="empty-link">Explore the shop</Link></div>;

  return <div className="checkout-layout">
    <form className="checkout-form" onSubmit={handleSubmit}>
      {addresses.length > 0 && <label className="checkout-saved-address">Use a saved delivery address
        <select defaultValue={addresses[0]?.id ?? ""} onChange={(event) => selectSavedAddress(event.target.value)}>
          {addresses.map((saved) => <option key={saved.id} value={saved.id}>{saved.recipient_name} — {saved.city}, {saved.country_code}</option>)}
          <option value="">Enter a different address</option>
        </select>
      </label>}
      <section className="checkout-section">
        <div className="section-kicker">01 / DELIVERY ADDRESS</div>
        <h2>Enter your delivery address</h2>
        <div className="checkout-fields">
          <label>Postal code<input required maxLength={24} autoComplete="postal-code" value={address.postal_code} onChange={(event) => updateAddress("postal_code", event.target.value)}/></label>
          <label>Country code<input required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" autoComplete="country" placeholder="Two-letter country code (for example, JP)" value={address.country_code} onChange={(event) => updateAddress("country_code", event.target.value)}/></label>
          <label>State / region<input maxLength={120} autoComplete="address-level1" value={address.region ?? ""} onChange={(event) => updateAddress("region", event.target.value)}/></label>
          <label>City<input required maxLength={120} autoComplete="address-level2" value={address.city} onChange={(event) => updateAddress("city", event.target.value)}/></label>
          <label>Street address<input required maxLength={240} autoComplete="address-line1" value={address.address_line_1} onChange={(event) => updateAddress("address_line_1", event.target.value)}/></label>
          <label>Apartment, suite or building (optional)<input maxLength={240} autoComplete="address-line2" value={address.address_line_2 ?? ""} onChange={(event) => updateAddress("address_line_2", event.target.value)}/></label>
          <label>Full name<input required maxLength={160} autoComplete="name" value={address.recipient_name} onChange={(event) => updateAddress("recipient_name", event.target.value)}/></label>
          <label>Phone number<input maxLength={40} autoComplete="tel" value={address.phone ?? ""} onChange={(event) => updateAddress("phone", event.target.value)}/></label>
        </div>
      </section>

      <section className="checkout-section">
        <div className="section-kicker">02 / SHIPPING METHOD</div>
        <h2>Available shipping methods</h2>
        {!currency && <p className="checkout-blocker">All items in your cart must use the same currency to continue.</p>}
        {matchingZones.length > 1 && <p className="checkout-blocker">Multiple shipping zones are configured for this country. Checkout is unavailable until the configuration is resolved.</p>}
        {currency && matchingZones.length === 0 && <p className="checkout-blocker">No shipping zone is configured for destination {address.country_code || "not selected"}. Unverified shipping costs and delivery times will not be shown.</p>}
        {currency && matchingZones.length === 1 && matchingRates.length === 0 && <p className="checkout-blocker">No approved shipping rate is configured for destination {address.country_code || "not selected"} and currency {currency}. Unverified shipping costs and delivery times will not be shown.</p>}
        {matchingRates.length > 0 && <label>配送方法
          <select value={effectiveRateId} onChange={(event) => setShippingRateId(event.target.value)} required>
            <option value="" disabled>Choose a shipping method</option>
            {matchingRates.map((rate) => <option key={rate.id} value={rate.id}>{rate.name} — {formatMoneyFromMinor(rate.amount_minor, rate.currency)}</option>)}
          </select>
        </label>}
        {selectedRate && <div className="checkout-disclosure">
          <strong>{selectedRate.name}</strong>
          {selectedRate.min_delivery_days !== null && selectedRate.max_delivery_days !== null
            ? <p>Configured delivery estimate: {selectedRate.min_delivery_days}–{selectedRate.max_delivery_days} days</p>
            : <p>No delivery estimate is configured for this shipping method.</p>}
          <p>{selectedRate.duties_disclosure}</p>
        </div>}
      </section>

      <section className="checkout-section">
        <div className="section-kicker">03 / TAXES & DUTIES</div>
        <h2>DESTINATION INFORMATION</h2>
        {!currency || matchingTaxRules.length === 0
          ? <p className="checkout-blocker">No approved tax configuration exists for this country and currency. Checkout remains unavailable until the business registers the applicable tax rule, including a confirmed zero rate if relevant.</p>
          : matchingTaxRules.map((rule) => <div className="checkout-disclosure" key={rule.id}><strong>{rule.tax_name}</strong><p>{rule.disclosure}</p></div>)}
      </section>

      <section className="checkout-section">
        <div className="section-kicker">04 / ORDER NOTE</div>
        <label>Delivery note (optional)<textarea maxLength={1000} rows={3} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)}/></label>
      </section>
      {cartError && <p className="checkout-error" role="alert">{cartError}</p>}
      {message && <p className="checkout-error" role="alert">{message}</p>}
      {holdExpiry && <p className="checkout-blocker" role="status">Stock is temporarily reserved until {new Date(holdExpiry).toLocaleString("en-IN")}. If an order draft is not created, the configured process will release the reservation.</p>}
      <div className="checkout-notice" role="note">This action creates an unpaid order draft only; no payment is collected. The draft and temporary stock reservation expire. Payments will remain disabled until the payment provider and webhooks have been fully verified.</div>
      <button className="button-primary dark-button" type="submit" disabled={!canPrepare || busy}>{busy ? "Creating order draft…" : "Create order draft"}</button>
    </form>
    <aside className="cart-summary checkout-summary">
      <div className="section-kicker">Items in your cart</div><h2>ORDER SUMMARY</h2>
      {preview.map((item) => <div className="cart-summary-row" key={item.slug + "::" + (item.variantId ?? "")}><span>{item.name}{item.variantLabel ? " · " + item.variantLabel : ""} × {item.quantityRequested}</span><strong>{item.priceMinor !== null && item.currency ? formatMoneyFromMinor(item.priceMinor * item.quantityRequested, item.currency) : "Unavailable"}</strong></div>)}
      <p>Product prices are revalidated against the current catalogue. Shipping and configured taxes are recalculated server-side before the order draft is created.</p>
      {currency && <p>Currency: <strong>{currency}</strong></p>}
      {isLoading && <p className="cart-state">Checking availability…</p>}
    </aside>
  </div>;
}
