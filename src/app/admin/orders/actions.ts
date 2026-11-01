"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function textField(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(key + " is too long.");
  return trimmed;
}

export async function updateShipment(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Order management is not configured.");
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Administrator sign-in is required.");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError || !profile || !["admin", "owner"].includes(profile.role)) throw new Error("Administrator permissions are required.");

  const id = textField(formData, "id", 80);
  const carrier = textField(formData, "tracking_carrier", 100);
  const number = textField(formData, "tracking_number", 160);
  const rawUrl = textField(formData, "tracking_url", 1000);
  if (!id || !carrier || !number) throw new Error("Order, carrier and tracking number are required.");
  let trackingUrl: string | null = null;
  if (rawUrl) {
    try { const parsed = new URL(rawUrl); if (parsed.protocol !== "https:") throw new Error(); trackingUrl = parsed.toString(); }
    catch { throw new Error("Tracking URL must be a valid HTTPS link."); }
  }

  const { data: order, error: orderError } = await supabase.from("orders")
    .select("id,status,shipped_at").eq("id", id).maybeSingle();
  if (orderError || !order) throw new Error("Order was not found.");
  if (!["paid", "processing", "shipped", "delivered"].includes(order.status)) {
    throw new Error("Only paid or fulfilled orders can receive shipment tracking.");
  }
  const nextStatus = ["paid", "processing"].includes(order.status) ? "shipped" : order.status;
  const { error } = await supabase.from("orders").update({
    tracking_carrier: carrier,
    tracking_number: number,
    tracking_url: trackingUrl,
    status: nextStatus,
    shipped_at: order.shipped_at ?? new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new Error("Unable to save shipment details. " + error.message);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/" + id);
  revalidatePath("/account");
  revalidatePath("/account/orders/" + id);
}
