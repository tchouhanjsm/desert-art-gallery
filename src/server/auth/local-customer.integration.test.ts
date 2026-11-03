import { createHash, randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll, afterEach, beforeEach, describe, expect, it, vi,
} from "vitest";

const cookieJar = vi.hoisted(() => ({ values: {} as Record<string, string> }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get(name: string) {
      const value = cookieJar.values[name];
      return value ? { value } : undefined;
    },
    set(name: string, value: string) {
      cookieJar.values[name] = value;
    },
    delete(name: string) {
      delete cookieJar.values[name];
    },
  }),
}));

import { closeMySqlPool, getMySqlDb } from "../db";
import { customerAddresses, customerSessions, customerUsers } from "../db/schema";
import {
  createLocalCustomerAccount,
  createLocalCustomerSession,
  destroyLocalCustomerSession,
  getCurrentCustomer,
  LOCAL_CUSTOMER_SESSION_COOKIE,
} from "./local-customer";
import { verifyOwnerPassword } from "./password";
import {
  deleteCustomerAddress,
  listCustomerAddresses,
  saveCustomerAddress,
} from "../customer/repository";

const enabled = process.env.MYSQL_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite("MySQL customer identity acceptance", () => {
  beforeEach(() => {
    cookieJar.values = {};
    vi.stubEnv("MYSQL_CUSTOMER_AUTH_ENABLED", "true");
    vi.stubEnv("MYSQL_CATALOGUE_ENABLED", "true");
  });

  afterEach(() => {
    cookieJar.values = {};
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await closeMySqlPool();
  });

  it("rejects direct registration and login calls while customer auth is disabled", async () => {
    vi.stubEnv("MYSQL_CUSTOMER_AUTH_ENABLED", "false");
    await expect(createLocalCustomerAccount({
      email: "disabled-" + randomUUID() + "@example.test",
      password: "Gallery-Customer-Password-2026",
      displayName: "Disabled Customer",
    })).rejects.toThrow("Customer authentication is not enabled");
    await expect(createLocalCustomerSession("customer@example.test", "Gallery-Customer-Password-2026"))
      .rejects.toThrow("Customer authentication is not enabled");
    expect(await getCurrentCustomer()).toBeNull();
  });

  it("registers, hashes credentials, stores only a session digest and serializes failed-login lockouts", async () => {
    const db = getMySqlDb();
    const id = randomUUID();
    const email = "customer-" + id + "@example.test";
    const password = "Gallery-Customer-Password-2026";
    try {
      await createLocalCustomerAccount({ email, password, displayName: "Integration Customer" });
      const [customer] = await db.select().from(customerUsers).where(eq(customerUsers.email, email)).limit(1);
      expect(customer).toBeDefined();
      expect(customer.passwordHash).not.toContain(password);
      expect(verifyOwnerPassword(password, customer.passwordHash)).toBe(true);
      expect(verifyOwnerPassword("incorrect-password", customer.passwordHash)).toBe(false);

      const rawToken = cookieJar.values[LOCAL_CUSTOMER_SESSION_COOKIE];
      expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const expectedDigest = createHash("sha256").update(rawToken).digest("hex");
      const [session] = await db.select().from(customerSessions)
        .where(eq(customerSessions.customerUserId, customer.id)).limit(1);
      expect(session?.tokenHash).toBe(expectedDigest);
      expect(session?.tokenHash).not.toBe(rawToken);
      expect(await getCurrentCustomer()).toMatchObject({ id: customer.id, email });

      await destroyLocalCustomerSession();
      expect(await getCurrentCustomer()).toBeNull();

      const failures = await Promise.all(Array.from({ length: 5 }, async () => {
        try {
          await createLocalCustomerSession(email, "Wrong-Customer-Password-2026");
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : "unexpected error";
        }
      }));
      expect(failures).toEqual(Array(5).fill("Email or password is incorrect."));

      const [lockedCustomer] = await db.select().from(customerUsers)
        .where(eq(customerUsers.id, customer.id)).limit(1);
      expect(lockedCustomer.failedLoginCount).toBe(5);
      expect(lockedCustomer.lockedUntil).toBeInstanceOf(Date);
      expect(lockedCustomer.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

      await expect(createLocalCustomerSession(email, password))
        .rejects.toThrow("Email or password is incorrect.");

      await db.update(customerUsers).set({
        failedLoginCount: 0,
        lockedUntil: new Date(Date.now() - 1_000),
      }).where(eq(customerUsers.id, customer.id));

      await createLocalCustomerSession(email, password);
      expect(await getCurrentCustomer()).toMatchObject({ id: customer.id, email });
    } finally {
      const [customer] = await db.select({ id: customerUsers.id }).from(customerUsers)
        .where(eq(customerUsers.email, email)).limit(1);
      if (customer) {
        await db.delete(customerSessions).where(eq(customerSessions.customerUserId, customer.id));
        await db.delete(customerAddresses).where(eq(customerAddresses.customerUserId, customer.id));
        await db.delete(customerUsers).where(eq(customerUsers.id, customer.id));
      }
    }
  }, 90_000);

  it("keeps saved addresses customer-scoped and maintains one default address", async () => {
    const db = getMySqlDb();
    const firstEmail = "address-owner-" + randomUUID() + "@example.test";
    const secondEmail = "address-other-" + randomUUID() + "@example.test";
    const password = "Gallery-Customer-Password-2026";
    let firstCustomerId: string | null = null;
    let secondCustomerId: string | null = null;

    const address = (recipientName: string, city: string, isDefaultShipping: boolean) => ({
      recipientName,
      addressLine1: "12 Fort Road",
      addressLine2: "",
      city,
      region: "Rajasthan",
      postalCode: "345001",
      countryCode: "IN",
      phone: "+91 9876543210",
      isDefaultShipping,
    });

    try {
      await createLocalCustomerAccount({ email: firstEmail, password, displayName: "First Customer" });
      await createLocalCustomerAccount({ email: secondEmail, password, displayName: "Second Customer" });
      const [first] = await db.select().from(customerUsers).where(eq(customerUsers.email, firstEmail)).limit(1);
      const [second] = await db.select().from(customerUsers).where(eq(customerUsers.email, secondEmail)).limit(1);
      firstCustomerId = first.id;
      secondCustomerId = second.id;

      await saveCustomerAddress(first.id, address("First Recipient", "Jaisalmer", false));
      const [firstAddress] = await listCustomerAddresses(first.id);
      expect(firstAddress.isDefaultShipping).toBe(true);

      await saveCustomerAddress(first.id, address("Second Recipient", "Jaipur", true));
      const firstAddresses = await listCustomerAddresses(first.id);
      expect(firstAddresses).toHaveLength(2);
      expect(firstAddresses.filter((row) => row.isDefaultShipping)).toHaveLength(1);
      const defaultAddress = firstAddresses.find((row) => row.isDefaultShipping)!;
      expect(defaultAddress.city).toBe("Jaipur");

      await saveCustomerAddress(second.id, address("Other Recipient", "Jodhpur", true));
      const [otherAddress] = await listCustomerAddresses(second.id);
      await expect(saveCustomerAddress(first.id, {
        id: otherAddress.id,
        ...address("Attempted Cross-account Edit", "Delhi", true),
      })).rejects.toThrow("could not be found");
      await expect(deleteCustomerAddress(first.id, otherAddress.id))
        .rejects.toThrow("could not be found");

      await deleteCustomerAddress(first.id, defaultAddress.id);
      const remainingFirstAddresses = await listCustomerAddresses(first.id);
      expect(remainingFirstAddresses).toHaveLength(1);
      expect(remainingFirstAddresses[0].isDefaultShipping).toBe(true);
      expect((await listCustomerAddresses(second.id)).map((row) => row.id)).toEqual([otherAddress.id]);
    } finally {
      const customerIds = [firstCustomerId, secondCustomerId].filter((id): id is string => Boolean(id));
      if (customerIds.length) {
        await db.delete(customerAddresses).where(inArray(customerAddresses.customerUserId, customerIds));
        await db.delete(customerSessions).where(inArray(customerSessions.customerUserId, customerIds));
        await db.delete(customerUsers).where(inArray(customerUsers.id, customerIds));
      }
    }
  }, 60_000);
});
