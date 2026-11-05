"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { formatMoneyFromMinor } from "@/lib/money";
import { formatCartFallbackName, getCartDisplayRows } from "@/lib/cart-presentation";
import type { CheckoutAddress } from "@/lib/checkout";
import {
  buildCheckoutAttemptFingerprint,
  buildReservationFingerprint,
  getCheckoutAttemptKeys,
  type CheckoutAttemptKeys,
} from "@/lib/checkout-attempt";

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
  const [selectedAddressId, setSelectedAddressId] = useState(addresses[0]?.id ?? "");
  const [customerNote, setCustomerNote] = useState("");
  const [shippingRateId, setShippingRateId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [holdExpiry, setHoldExpiry] = useState("");
  const [orderRetryLocked, setOrderRetryLocked] = useState(false);
  const checkoutAttempt = useRef<CheckoutAttemptKeys | null>(null);

  const currencies = [...new Set(preview.map((item) => item.currency).filter((value): value is string => Boolean(value)))];
  const summaryRows = getCartDisplayRows(lines, preview);
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
    setSelectedAddressId("");
    setMessage("");
    setAddress((current) => ({ ...current, [field]: field === "country_code" ? value.toUpperCase().slice(0, 2) : value }));
  }

  function selectSavedAddress(id: string) {
    setSelectedAddressId(id);
    setMessage("");
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
    let orderRequestStarted = false;
    let orderResponseParsed = false;
    let lockRetryForExistingDraft = false;
    let reservationExpired = false;
    try {
      const fingerprint = buildCheckoutAttemptFingerprint({
        lines,
        address,
        shippingRateId: selectedRate.id,
        customerNote,
      });
      const reservationFingerprint = buildReservationFingerprint(lines);
      const attempt = getCheckoutAttemptKeys(
        fingerprint,
        reservationFingerprint,
        checkoutAttempt.current,
        () => crypto.randomUUID(),
      );
      checkoutAttempt.current = attempt;
      const reserveResponse = await fetch("/api/cart/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.reservationKey },
        body: JSON.stringify({ lines }),
        cache: "no-store",
      });
      const reservation = await reserveResponse.json();
      if (!reserveResponse.ok || typeof reservation.reservation_id !== "string") {
        if (reserveResponse.status === 409) checkoutAttempt.current = null;
        throw new Error(reservation.error || "Could not reserve the requested stock. Update your bag and try again.");
      }
      if (typeof reservation.expires_at === "string") setHoldExpiry(reservation.expires_at);

      orderRequestStarted = true;
      const response = await fetch("/api/checkout/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: reservation.reservation_id,
          shippingRateId: selectedRate.id,
          idempotencyKey: attempt.orderDraftKey,
          shippingAddress: address,
          customerNote,
        }),
        cache: "no-store",
      });
      const result = await response.json();
      orderResponseParsed = true;
      if (!response.ok || typeof result.order_id !== "string") {
        const errorMessage = typeof result.error === "string" && result.error.trim() ? result.error : "Could not create an order draft.";
        if (/(reservation|order draft|checkout).*(expired|released)|(?:expired).*(reservation|draft)/i.test(errorMessage)) {
          checkoutAttempt.current = null;
          setHoldExpiry("");
          setOrderRetryLocked(false);
          reservationExpired = true;
        } else if (/already linked|already used with different order details|already exists with different checkout/i.test(errorMessage) || response.ok) {
          lockRetryForExistingDraft = true;
        }
        throw new Error(errorMessage);
      }
      setOrderRetryLocked(false);
      checkoutAttempt.current = null;
      router.push("/account/orders/" + result.order_id);
    } catch (cause) {
      if (orderRequestStarted && (!orderResponseParsed || lockRetryForExistingDraft) && !reservationExpired) setOrderRetryLocked(true);
      setMessage(cause instanceof Error ? cause.message : "Could not create an order draft.");
    } finally {
      setBusy(false);
    }
  }

  if (!lines.length) return <div className="empty-note">Your bag is empty. <Link href="/shop" className="empty-link">Continue shopping</Link></div>;

  return <div className="checkout-layout">
    <form className="checkout-form" onSubmit={handleSubmit}>
      {addresses.length > 0 && <label className="checkout-saved-address">Use a saved delivery address
        <select value={selectedAddressId} disabled={orderRetryLocked} onChange={(event) => selectSavedAddress(event.target.value)}>
          {addresses.map((saved) => <option key={saved.id} value={saved.id}>{saved.recipient_name} — {saved.city}, {saved.country_code}</option>)}
          <option value="">Enter a different address</option>
        </select>
        <small>Editing any field switches to a one-time delivery address. Your saved address is not changed.</small>
      </label>}
      <section className="checkout-section">
        <div className="section-kicker">01 / DELIVERY ADDRESS</div>
        <h2>Enter your delivery address</h2>
        <div className="checkout-fields">
          <label>Postal code<input required maxLength={24} autoComplete="postal-code" disabled={orderRetryLocked} value={address.postal_code} onChange={(event) => updateAddress("postal_code", event.target.value)}/></label>
          <label>Country code<input required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" autoComplete="country" disabled={orderRetryLocked} placeholder="Two-letter country code (e.g. IN, US or JP)" value={address.country_code} onChange={(event) => updateAddress("country_code", event.target.value)}/></label>
          <label>State / region<input maxLength={120} autoComplete="address-level1" disabled={orderRetryLocked} value={address.region ?? ""} onChange={(event) => updateAddress("region", event.target.value)}/></label>
          <label>City<input required maxLength={120} autoComplete="address-level2" disabled={orderRetryLocked} value={address.city} onChange={(event) => updateAddress("city", event.target.value)}/></label>
          <label>Address line 1<input required maxLength={240} autoComplete="address-line1" disabled={orderRetryLocked} value={address.address_line_1} onChange={(event) => updateAddress("address_line_1", event.target.value)}/></label>
          <label>Building, apartment or suite (optional)<input maxLength={240} autoComplete="address-line2" disabled={orderRetryLocked} value={address.address_line_2 ?? ""} onChange={(event) => updateAddress("address_line_2", event.target.value)}/></label>
          <label>Full name<input required maxLength={160} autoComplete="name" disabled={orderRetryLocked} value={address.recipient_name} onChange={(event) => updateAddress("recipient_name", event.target.value)}/></label>
          <label>Phone number<input maxLength={40} autoComplete="tel" disabled={orderRetryLocked} value={address.phone ?? ""} onChange={(event) => updateAddress("phone", event.target.value)}/></label>
        </div>
      </section>

      <section className="checkout-section">
        <div className="section-kicker">02 / SHIPPING METHOD</div>
        <h2>Available shipping methods</h2>
        {!currency && <p className="checkout-blocker">All items in your bag must use the same currency to continue.</p>}
        {matchingZones.length > 1 && <p className="checkout-blocker">More than one shipping zone is configured for this country. Checkout is unavailable until the configuration is resolved.</p>}
        {currency && matchingZones.length === 0 && <p className="checkout-blocker">Destination {address.country_code || "not selected"} has no configured shipping zone. Unverified charges and delivery estimates are not shown.</p>}
        {currency && matchingZones.length === 1 && matchingRates.length === 0 && <p className="checkout-blocker">Destination {address.country_code || "not selected"} · currency {currency} has no approved shipping rate. Unverified charges and delivery estimates are not shown.</p>}
        {matchingRates.length > 0 && <label>Shipping method
          <select value={effectiveRateId} disabled={orderRetryLocked} onChange={(event) => setShippingRateId(event.target.value)} required>
            <option value="" disabled>Select a shipping method</option>
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
        <h2>DESTINATION CHARGES</h2>
        {!currency || matchingTaxRules.length === 0
          ? <p className="checkout-blocker">There is no approved tax configuration for this country and currency. Checkout remains disabled until the merchant configures the applicable rule, including a confirmed zero rate if relevant.</p>
          : matchingTaxRules.map((rule) => <div className="checkout-disclosure" key={rule.id}><strong>{rule.tax_name}</strong><p>{rule.disclosure}</p></div>)}
      </section>

      <section className="checkout-section">
        <div className="section-kicker">04 / ORDER NOTE</div>
        <label>Delivery note (optional)<textarea maxLength={1000} rows={3} disabled={orderRetryLocked} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)}/></label>
      </section>
      {orderRetryLocked && <p className="checkout-retry-locked" role="alert">We could not confirm the order response. Your checkout details are locked so a retry can safely recover the same order. Retry without refreshing this page or changing the bag.</p>}
      {cartError && <p className="checkout-error" role="alert">{cartError}</p>}
      {message && <p className="checkout-error" role="alert">{message}</p>}
      {holdExpiry && <p className="checkout-blocker" role="status">Stock is temporarily reserved until {new Date(holdExpiry).toLocaleString("en-IN")}. If an order draft is not created, the configured process will release the reservation.</p>}
      <div className="checkout-notice" role="note">This action creates an unpaid order draft only; no payment is taken. The draft and temporary stock reservation expire. Payments will be enabled only after the payment provider and webhook have been verified.</div>
      <button className="button-primary dark-button" type="submit" disabled={!canPrepare || busy}>{busy ? "Creating order draft…" : orderRetryLocked ? "Retry order draft" : "Create unpaid order draft"}</button>
    </form>
    <aside className="cart-summary checkout-summary" aria-labelledby="checkout-summary-heading">
      <div className="section-kicker">ITEMS IN YOUR BAG</div>
      <h2 id="checkout-summary-heading">ORDER SUMMARY</h2>
      <div aria-live="polite">
        {summaryRows.map(({ line, item }) => <div className="cart-summary-row" key={line.slug + "::" + (line.variantId ?? "")}>
          <span>{item?.name ?? formatCartFallbackName(line.slug)}{item?.variantLabel ? " · " + item.variantLabel : ""} × {line.quantity}</span>
          <strong>{item && item.priceMinor !== null && item.currency ? formatMoneyFromMinor(item.priceMinor * line.quantity, item.currency) : "Awaiting verification"}</strong>
        </div>)}
        {currency && selectedRate && (
          <div className="cart-summary-row">
            <span>Configured shipping</span>
            <strong>{formatMoneyFromMinor(selectedRate.amount_minor, selectedRate.currency)}</strong>
          </div>
        )}
        {currency && matchingTaxRules.length > 0 && (
          <div className="cart-summary-row">
            <span>Destination taxes</span>
            <strong>Calculated by server</strong>
          </div>
        )}
      </div>
      <p>Catalogue prices and configured shipping are shown above. The server calculates the final tax and order total from the current reservation and destination rules.</p>
      <p className="checkout-total-pending">Your confirmed total will appear in the order review after the unpaid draft is prepared. This step does not take payment.</p>
      {currency && <p>Currency: <strong>{currency}</strong></p>}
      {isLoading && <p className="cart-state" role="status">Checking availability…</p>}
    </aside>
  </div>;
}
