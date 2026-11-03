"use server";

import { redirect } from "next/navigation";
import { getSafeRedirectPath } from "@/lib/safe-redirect";
import { createLocalCustomerSession } from "@/server/auth/local-customer";

export type CustomerLoginState = { error?: string };

export async function signInCustomer(
  _previous: CustomerLoginState,
  formData: FormData,
): Promise<CustomerLoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const next = formData.get("next");
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Enter your email address and password." };
  }
  try {
    await createLocalCustomerSession(email, password);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to sign in." };
  }
  const destination = getSafeRedirectPath(typeof next === "string" ? next : null, "https://local.invalid", "/account");
  redirect(destination);
}
