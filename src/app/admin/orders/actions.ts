"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMySqlCatalogueEnabled } from "@/server/db";
import { requireLocalAdmin } from "@/server/auth/local-admin";
import { transitionMySqlOrderFulfilment } from "@/server/checkout/mysql-orders";

function textField(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(key + " is too long.");
  return trimmed;
}

export async function transitionOrder(formData: FormData) {
  if (isMySqlCatalogueEnabled()) {
    const admin = await requireLocalAdmin();
    if (!["owner", "admin"].includes(admin.role)) throw new Error("Administrator permissions are required.");
    const id = textField(formData, "id", 80);
    const nextStatus = textField(formData, "next_status", 24);
    const carrier = textField(formData, "tracking_carrier", 100);
    const trackingNumber = textField(formData, "tracking_number", 160);
    const trackingUrl = textField(formData, "tracking_url", 1000);
    await transitionMySqlOrderFulfilment({
      adminId: admin.id,
      orderId: id,
      nextStatus,
      carrier: carrier || null,
      trackingNumber: trackingNumber || null,
      trackingUrl: trackingUrl || null,
    });
    revalidatePath("/admin/orders");
    revalidatePath("/admin/orders/" + id);
    revalidatePath("/account");
    revalidatePath("/account/orders/" + id);
    return;
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Order management is not configured.");
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Administrator sign-in is required.");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError || !profile || !["admin", "owner"].includes(profile.role)) throw new Error("Administrator permissions are required.");

  const id = textField(formData, "id", 80);
  const nextStatus = textField(formData, "next_status", 24);
  const carrier = textField(formData, "tracking_carrier", 100);
  const number = textField(formData, "tracking_number", 160);
  const rawUrl = textField(formData, "tracking_url", 1000);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error("A valid order is required.");
  if (!["processing", "shipped", "delivered"].includes(nextStatus)) throw new Error("The requested fulfilment step is not allowed.");
  let trackingUrl: string | null = null;
  if (rawUrl) {
    try { const parsed = new URL(rawUrl); if (parsed.protocol !== "https:") throw new Error(); trackingUrl = parsed.toString(); }
    catch { throw new Error("Tracking URL must be a valid HTTPS link."); }
  }
  if (nextStatus === "shipped" && (!carrier || !number)) throw new Error("Carrier and tracking number are required before shipment.");

  const { error } = await supabase.rpc("transition_order_fulfilment", {
    p_order_id: id,
    p_next_status: nextStatus,
    p_tracking_carrier: carrier || null,
    p_tracking_number: number || null,
    p_tracking_url: trackingUrl,
  });
  if (error) throw new Error("Unable to update fulfilment. Confirm the order is at the preceding state and try again.");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/" + id);
  revalidatePath("/account");
  revalidatePath("/account/orders/" + id);
}
