"use server";

import { redirect } from "next/navigation";
import {
  createLocalAdminSession,
  destroyLocalAdminSession,
} from "@/server/auth/local-admin";

export type LocalOwnerLoginState = {
  error?: string;
};

export async function signInLocalOwner(
  _previous: LocalOwnerLoginState,
  formData: FormData,
): Promise<LocalOwnerLoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Enter your owner email and password." };
  }
  try {
    await createLocalAdminSession(email, password);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to sign in." };
  }
  redirect("/admin");
}

export async function signOutLocalOwner() {
  await destroyLocalAdminSession();
  redirect("/owner/login");
}
