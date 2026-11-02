"use server";

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMySqlDb } from "@/server/db";
import { addresses, users } from "@/server/db/schema";
import { requireUser, signOutSession } from "@/server/auth/session";

function field(formData: FormData, key: string, max = 300) {
  const value = formData.get(key);
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (text.length > max) throw new Error(key + " is too long.");
  return text;
}

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const fullName = field(formData, "full_name", 160);
  const phone = field(formData, "phone", 40);
  if (!fullName) throw new Error("Please enter your name.");
  await getMySqlDb().update(users).set({ fullName, phone, updatedAt: new Date() }).where(eq(users.id, user.id));
  revalidatePath("/account");
}

export async function signOutCustomer() {
  await signOutSession();
  redirect("/login");
}

export async function saveAddress(formData: FormData) {
  const user = await requireUser();
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
  const db = getMySqlDb();
  await db.transaction(async (tx) => {
    if (isDefault) {
      await tx.update(addresses).set({ isDefaultShipping: false, updatedAt: new Date() }).where(eq(addresses.userId, user.id));
    }
    const values = {
      recipientName, addressLine1: line1, addressLine2: line2 || null, city,
      region: region || null, postalCode, countryCode, phone: phone || null,
      isDefaultShipping: isDefault, updatedAt: new Date(),
    };
    if (rawId) {
      const [existing] = await tx.select({ id: addresses.id }).from(addresses)
        .where(and(eq(addresses.id, rawId), eq(addresses.userId, user.id))).limit(1);
      if (!existing) throw new Error("Address was not found.");
      await tx.update(addresses).set(values).where(eq(addresses.id, rawId));
    } else {
      await tx.insert(addresses).values({ id: randomUUID(), userId: user.id, ...values, createdAt: new Date() });
    }
  });
  revalidatePath("/account");
}

export async function deleteAddress(formData: FormData) {
  const user = await requireUser();
  const id = field(formData, "id", 80);
  if (!id) throw new Error("Address ID is required.");
  await getMySqlDb().delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, user.id)));
  revalidatePath("/account");
}
