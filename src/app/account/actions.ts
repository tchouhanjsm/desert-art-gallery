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
