import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/CheckoutForm";
import { getCurrentCustomer, isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";

export const metadata = {
  title: "Delivery and order review",
  description: "Review delivery details and prepare an unpaid order draft.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  if (isMySqlCustomerAuthEnabled()) {
    const customer = await getCurrentCustomer();
    if (!customer) redirect("/login?next=%2Fcheckout");
    return <div className="page-shell"><div className="page-heading"><div className="section-kicker">ORDER REVIEW</div><h1>Checkout is the next phase</h1><p>Your MySQL customer account and shopping bag are available. Order creation, shipping/tax configuration and fulfilment are still being migrated.</p></div><div className="checkout-notice" role="status">No order, inventory reservation or payment has been created. Your bag remains saved while Phase 7 is implemented.</div><Link className="text-link" href="/cart">RETURN TO YOUR BAG</Link></div>;
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell"><div className="page-heading"><div className="section-kicker">SECURE ORDER REVIEW</div><h1>Delivery details</h1><p>Checkout is not configured yet. No order or payment has been created.</p></div><Link className="text-link" href="/cart">RETURN TO YOUR BAG</Link></div>;

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
    return <div className="page-shell"><div className="page-heading"><div className="section-kicker">ORDER REVIEW</div><h1>Delivery details</h1><p>Checkout configuration is not ready. No order or payment has been created.</p></div><div className="checkout-notice" role="status">The gallery must configure and verify destination-specific shipping, tax and duties disclosures before an order draft can be prepared.</div><Link className="text-link" href="/cart">RETURN TO YOUR BAG</Link></div>;
  }

  const savedAddresses = (addresses.data ?? []).map((address) => ({
    ...address, address_line_2: address.address_line_2 ?? "", region: address.region ?? "", phone: address.phone ?? "",
  }));

  return <div className="page-shell">
    <div className="page-heading"><div className="section-kicker">ORDER REVIEW</div><h1>Delivery details</h1><p>Choose a configured delivery option and review the destination disclosures.</p></div>
    <CheckoutForm
      addresses={savedAddresses}
      zones={zones.data ?? []}
      rates={rates.data ?? []}
      taxRules={taxRules.data ?? []}
    />
  </div>;
}
