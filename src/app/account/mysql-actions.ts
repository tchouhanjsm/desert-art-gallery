"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCustomer, destroyLocalCustomerSession } from "@/server/auth/local-customer";
import {
  deleteCustomerAddress,
  saveCustomerAddress,
  updateCustomerProfile,
} from "@/server/customer/repository";

async function requireCustomer() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");
  return customer;
}

function formString(formData: FormData, key: string, maximum: number): string {
  const value = formData.get(key);
  if (typeof value !== "string") return "";
  const cleaned = value.trim();
  if (cleaned.length > maximum) throw new Error("The " + key.replaceAll("_", " ") + " field is too long.");
  return cleaned;
}

export async function signOutLocalCustomer() {
  await destroyLocalCustomerSession();
  redirect("/login");
}

export async function updateLocalCustomerProfile(formData: FormData) {
  const customer = await requireCustomer();
  await updateCustomerProfile(customer.id, {
    displayName: formString(formData, "display_name", 160),
    phone: formString(formData, "phone", 40),
  });
  revalidatePath("/account");
}

export async function saveLocalCustomerAddress(formData: FormData) {
  const customer = await requireCustomer();
  await saveCustomerAddress(customer.id, {
    id: formString(formData, "id", 36) || undefined,
    recipientName: formString(formData, "recipient_name", 160),
    addressLine1: formString(formData, "address_line_1", 240),
    addressLine2: formString(formData, "address_line_2", 240),
    city: formString(formData, "city", 120),
    region: formString(formData, "region", 120),
    postalCode: formString(formData, "postal_code", 24),
    countryCode: formString(formData, "country_code", 2),
    phone: formString(formData, "phone", 40),
    isDefaultShipping: formData.get("is_default_shipping") === "yes",
  });
  revalidatePath("/account");
}

export async function deleteLocalCustomerAddress(formData: FormData) {
  const customer = await requireCustomer();
  const id = formString(formData, "id", 36);
  await deleteCustomerAddress(customer.id, id);
  revalidatePath("/account");
}
