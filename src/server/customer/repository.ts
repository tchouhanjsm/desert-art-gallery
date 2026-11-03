import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { parseCustomerAddressInput, validateCustomerDisplayName, validateCustomerPhone, type CustomerAddressInput } from "@/lib/customer-account";
import { getMySqlDb } from "@/server/db";
import { customerAddresses, customerUsers } from "@/server/db/schema";

export async function listCustomerAddresses(customerUserId: string) {
  return getMySqlDb().select().from(customerAddresses)
    .where(eq(customerAddresses.customerUserId, customerUserId))
    .orderBy(desc(customerAddresses.isDefaultShipping), desc(customerAddresses.createdAt));
}

export async function updateCustomerProfile(customerUserId: string, input: { displayName: unknown; phone: unknown }): Promise<void> {
  const displayName = validateCustomerDisplayName(input.displayName);
  const phone = validateCustomerPhone(input.phone);
  await getMySqlDb().update(customerUsers).set({ displayName, phone, updatedAt: new Date() })
    .where(eq(customerUsers.id, customerUserId));
}

export async function saveCustomerAddress(customerUserId: string, rawInput: unknown): Promise<void> {
  const input: CustomerAddressInput = parseCustomerAddressInput(rawInput);
  const db = getMySqlDb();
  await db.transaction(async (tx) => {
    const [customer] = await tx.select({ id: customerUsers.id }).from(customerUsers)
      .where(eq(customerUsers.id, customerUserId)).limit(1).for("update");
    if (!customer) throw new Error("Customer account was not found.");
    const existingRows = await tx.select().from(customerAddresses)
      .where(eq(customerAddresses.customerUserId, customerUserId))
      .orderBy(desc(customerAddresses.createdAt)).for("update");
    const existing = input.id ? existingRows.find((row) => row.id === input.id) : undefined;
    if (input.id && !existing) throw new Error("That delivery address could not be found.");
    if (!existing && existingRows.length >= 20) throw new Error("You can save up to 20 delivery addresses.");

    const anotherDefaultExists = existingRows.some((row) => row.isDefaultShipping && row.id !== existing?.id);
    const isDefaultShipping = input.isDefaultShipping || !anotherDefaultExists;
    const now = new Date();
    if (isDefaultShipping) {
      await tx.update(customerAddresses).set({ isDefaultShipping: false, updatedAt: now })
        .where(eq(customerAddresses.customerUserId, customerUserId));
    }
    const values = {
      recipientName: input.recipientName, addressLine1: input.addressLine1,
      addressLine2: input.addressLine2, city: input.city, region: input.region,
      postalCode: input.postalCode, countryCode: input.countryCode, phone: input.phone,
      isDefaultShipping, updatedAt: now,
    };
    if (existing) {
      await tx.update(customerAddresses).set(values)
        .where(and(eq(customerAddresses.id, existing.id), eq(customerAddresses.customerUserId, customerUserId)));
    } else {
      await tx.insert(customerAddresses).values({ id: randomUUID(), customerUserId, ...values, createdAt: now });
    }
  });
}

export async function deleteCustomerAddress(customerUserId: string, addressId: string): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(addressId)) {
    throw new Error("Choose a valid delivery address.");
  }
  const db = getMySqlDb();
  await db.transaction(async (tx) => {
    const [customer] = await tx.select({ id: customerUsers.id }).from(customerUsers)
      .where(eq(customerUsers.id, customerUserId)).limit(1).for("update");
    if (!customer) throw new Error("Customer account was not found.");
    const [address] = await tx.select().from(customerAddresses)
      .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerUserId, customerUserId)))
      .limit(1).for("update");
    if (!address) throw new Error("That delivery address could not be found.");
    await tx.delete(customerAddresses).where(and(
      eq(customerAddresses.id, addressId), eq(customerAddresses.customerUserId, customerUserId),
    ));
    if (!address.isDefaultShipping) return;
    const [replacement] = await tx.select({ id: customerAddresses.id }).from(customerAddresses)
      .where(eq(customerAddresses.customerUserId, customerUserId))
      .orderBy(desc(customerAddresses.createdAt)).limit(1);
    if (replacement) {
      await tx.update(customerAddresses).set({ isDefaultShipping: true, updatedAt: new Date() })
        .where(eq(customerAddresses.id, replacement.id));
    }
  });
}
