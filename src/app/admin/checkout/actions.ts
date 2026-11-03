"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCheckoutUuid, normalizeCountryCodes, parseCurrencyAmountToMinor } from "@/lib/checkout";
import { isMySqlCatalogueEnabled } from "@/server/db";
import { requireLocalAdmin } from "@/server/auth/local-admin";
import { saveMySqlShippingZone, saveMySqlShippingRate, saveMySqlTaxRule } from "@/server/checkout/mysql-orders";

function field(formData: FormData, key: string, maxLength: number): string {
  const value = formData.get(key);
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(key + " is too long.");
  return trimmed;
}

async function ownerClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Checkout configuration is not connected.");
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Owner sign-in is required.");
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error || profile?.role !== "owner") throw new Error("Only the business owner can change shipping and tax configuration.");
  return supabase;
}

function optionalDays(value: string): number | null {
  if (!value) return null;
  if (!/^\d{1,3}$/.test(value)) throw new Error("Delivery days must be a whole number from 0 to 365.");
  const days = Number(value);
  if (!Number.isInteger(days) || days < 0 || days > 365) throw new Error("Delivery days must be a whole number from 0 to 365.");
  return days;
}

export async function saveShippingZone(formData: FormData) {
  if (isMySqlCatalogueEnabled()) {
    const admin = await requireLocalAdmin();
    if (admin.role !== "owner") throw new Error("Only the business owner can change shipping and tax configuration.");
    const id = field(formData, "id", 40);
    if (id && !isCheckoutUuid(id)) throw new Error("Invalid shipping zone identifier.");
    await saveMySqlShippingZone({
      ...(id ? { id } : {}),
      name: field(formData, "name", 120),
      countryCodesText: field(formData, "country_codes", 500),
      isActive: formData.get("is_active") === "yes",
    });
    revalidatePath("/admin/checkout");
    revalidatePath("/checkout");
    return;
  }
  const supabase = await ownerClient();
  const id = field(formData, "id", 40);
  const name = field(formData, "name", 120);
  const countries = normalizeCountryCodes(field(formData, "country_codes", 500));
  if (!name || !countries) throw new Error("Provide a zone name and one or more valid two-letter country codes.");
  if (id && !isCheckoutUuid(id)) throw new Error("Invalid shipping zone identifier.");
  const values = { name, country_codes: countries, is_active: formData.get("is_active") === "yes" };
  const result = id
    ? await supabase.from("shipping_zones").update(values).eq("id", id)
    : await supabase.from("shipping_zones").insert(values);
  if (result.error) throw new Error("Unable to save shipping zone.");
  revalidatePath("/admin/checkout");
  revalidatePath("/checkout");
}

export async function saveShippingRate(formData: FormData) {
  if (isMySqlCatalogueEnabled()) {
    const admin = await requireLocalAdmin();
    if (admin.role !== "owner") throw new Error("Only the business owner can change shipping and tax configuration.");
    const id = field(formData, "id", 40);
    if (id && !isCheckoutUuid(id)) throw new Error("Invalid shipping rate identifier.");
    await saveMySqlShippingRate({
      ...(id ? { id } : {}),
      zoneId: field(formData, "zone_id", 40),
      name: field(formData, "name", 120),
      currency: field(formData, "currency", 3),
      amount: field(formData, "amount", 32),
      minDays: field(formData, "min_delivery_days", 3),
      maxDays: field(formData, "max_delivery_days", 3),
      dutiesDisclosure: field(formData, "duties_disclosure", 2000),
      isActive: formData.get("is_active") === "yes",
    });
    revalidatePath("/admin/checkout");
    revalidatePath("/checkout");
    return;
  }
  const supabase = await ownerClient();
  const id = field(formData, "id", 40);
  const zoneId = field(formData, "zone_id", 40);
  const name = field(formData, "name", 120);
  const currency = field(formData, "currency", 3).toUpperCase();
  const amount = field(formData, "amount", 32);
  const dutiesDisclosure = field(formData, "duties_disclosure", 2000);
  if (id && !isCheckoutUuid(id)) throw new Error("Invalid shipping rate identifier.");
  if (!isCheckoutUuid(zoneId) || !name || !/^[A-Z]{3}$/.test(currency) || !dutiesDisclosure) {
    throw new Error("A zone, rate name, ISO currency and merchant-approved duties disclosure are required.");
  }
  const amountMinor = parseCurrencyAmountToMinor(amount, currency);
  if (amountMinor === null) throw new Error("Enter a valid shipping amount using the currency's supported decimal precision.");
  const minDays = optionalDays(field(formData, "min_delivery_days", 3));
  const maxDays = optionalDays(field(formData, "max_delivery_days", 3));
  if ((minDays === null) !== (maxDays === null)) throw new Error("Enter both delivery-window endpoints or leave both blank.");
  if (minDays !== null && maxDays !== null && maxDays < minDays) throw new Error("Maximum delivery days cannot be lower than minimum delivery days.");
  const { data: zone, error: zoneError } = await supabase.from("shipping_zones").select("id").eq("id", zoneId).maybeSingle();
  if (zoneError || !zone) throw new Error("The selected shipping zone was not found.");
  const values = {
    zone_id: zoneId, name, currency, amount_minor: amountMinor,
    min_delivery_days: minDays, max_delivery_days: maxDays,
    duties_disclosure: dutiesDisclosure,
    is_active: formData.get("is_active") === "yes",
  };
  const result = id
    ? await supabase.from("shipping_rates").update(values).eq("id", id)
    : await supabase.from("shipping_rates").insert(values);
  if (result.error) throw new Error("Unable to save shipping rate.");
  revalidatePath("/admin/checkout");
  revalidatePath("/checkout");
}

export async function saveTaxRule(formData: FormData) {
  if (isMySqlCatalogueEnabled()) {
    const admin = await requireLocalAdmin();
    if (admin.role !== "owner") throw new Error("Only the business owner can change shipping and tax configuration.");
    const id = field(formData, "id", 40);
    if (id && !isCheckoutUuid(id)) throw new Error("Invalid tax rule identifier.");
    await saveMySqlTaxRule({
      ...(id ? { id } : {}),
      countryCode: field(formData, "country_code", 2),
      currency: field(formData, "currency", 3),
      taxName: field(formData, "tax_name", 120),
      rateBasisPoints: field(formData, "rate_basis_points", 5),
      taxableShipping: formData.get("taxable_shipping") === "yes",
      disclosure: field(formData, "disclosure", 2000),
      isActive: formData.get("is_active") === "yes",
    });
    revalidatePath("/admin/checkout");
    revalidatePath("/checkout");
    return;
  }
  const supabase = await ownerClient();
  const id = field(formData, "id", 40);
  const countryCode = field(formData, "country_code", 2).toUpperCase();
  const currency = field(formData, "currency", 3).toUpperCase();
  const taxName = field(formData, "tax_name", 120);
  const disclosure = field(formData, "disclosure", 2000);
  const rawRate = field(formData, "rate_basis_points", 5);
  if (id && !isCheckoutUuid(id)) throw new Error("Invalid tax rule identifier.");
  if (!/^[A-Z]{2}$/.test(countryCode) || !/^[A-Z]{3}$/.test(currency) || !taxName || !disclosure || !/^\d{1,5}$/.test(rawRate)) {
    throw new Error("Provide a country, currency, tax name, basis-point rate and approved disclosure.");
  }
  const rate = Number(rawRate);
  if (!Number.isInteger(rate) || rate < 0 || rate > 10000) throw new Error("Tax rate must be between 0 and 10,000 basis points.");
  const values = {
    country_code: countryCode, currency, tax_name: taxName,
    rate_basis_points: rate, taxable_shipping: formData.get("taxable_shipping") === "yes",
    disclosure, is_active: formData.get("is_active") === "yes",
  };
  const result = id
    ? await supabase.from("checkout_tax_rules").update(values).eq("id", id)
    : await supabase.from("checkout_tax_rules").insert(values);
  if (result.error) throw new Error("Unable to save tax rule. Check for a duplicate name in this country and currency.");
  revalidatePath("/admin/checkout");
  revalidatePath("/checkout");
}
