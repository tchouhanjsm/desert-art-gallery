"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function field(formData: FormData, key: string, max = 300) {
  const value = formData.get(key);
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (text.length > max) throw new Error(key + " is too long.");
  return text;
}

export async function updateProfile(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Account services are not configured.");
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const fullName = field(formData, "full_name", 160);
  const phone = field(formData, "phone", 40);
  if (!fullName) throw new Error("Please enter your name.");
  const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", user.id);
  if (error) throw new Error("Unable to update your profile.");
  revalidatePath("/account");
}

export async function signOutCustomer() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}

export async function saveAddress(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Account services are not configured.");
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const rawId = field(formData, "id", 80);
  const recipientName = field(formData, "recipient_name", 160);
  const line1 = field(formData, "address_line_1", 240);
  const line2 = field(formData, "address_line_2", 240);
  const city = field(formData, "city", 120);
  const region = field(formData, "region", 120);
  const postalCode = field(formData, "postal_code", 24);
  const countryCode = field(formData, "country_code", 2).toUpperCase();
  const phone = field(formData, "phone", 40);
  const isDefault = formData.get("is_default_shipping") === "yes";
  if (!recipientName || !line1 || !city || !postalCode || !/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error("Complete the required address fields and enter a two-letter country code.");
  }
  const { error } = await supabase.rpc("save_customer_address", {
    p_address_id: rawId || null,
    p_recipient_name: recipientName,
    p_address_line_1: line1,
    p_address_line_2: line2 || null,
    p_city: city,
    p_region: region || null,
    p_postal_code: postalCode,
    p_country_code: countryCode,
    p_phone: phone || null,
    p_is_default_shipping: isDefault,
  });
  if (error) throw new Error("Unable to save this address. " + error.message);
  revalidatePath("/account");
}

export async function deleteAddress(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Account services are not configured.");
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const id = field(formData, "id", 80);
  if (!id) throw new Error("Address ID is required.");
  const { error } = await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error("Unable to delete this address.");
  revalidatePath("/account");
}
