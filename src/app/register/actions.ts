"use server";

import { redirect } from "next/navigation";
import { createLocalCustomerAccount } from "@/server/auth/local-customer";

export type CustomerRegistrationState = { error?: string };

export async function registerCustomer(
  _previous: CustomerRegistrationState,
  formData: FormData,
): Promise<CustomerRegistrationState> {
  const email = formData.get("email");
  const displayName = formData.get("display_name");
  const password = formData.get("password");
  const confirmation = formData.get("password_confirmation");
  if (typeof email !== "string" || typeof displayName !== "string" || typeof password !== "string" || typeof confirmation !== "string") {
    return { error: "Complete all required fields." };
  }
  if (password !== confirmation) return { error: "The passwords do not match." };
  try {
    await createLocalCustomerAccount({ email, displayName, password });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create your account." };
  }
  redirect("/account");
}
