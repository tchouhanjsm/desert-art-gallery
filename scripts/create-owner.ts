import { randomUUID } from "node:crypto";
import { hashPassword } from "../src/server/auth/password";
import { closeMySqlPool, getMySqlDb, pingMySql } from "../src/server/db";
import { users } from "../src/server/db/schema";

async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Set a valid OWNER_EMAIL in .env before creating the initial owner.");
  }
  if (password.length < 14 || password.length > 128) {
    throw new Error("Set OWNER_PASSWORD to a unique password between 14 and 128 characters.");
  }
  if (!(await pingMySql())) throw new Error("Cannot connect to MySQL. Start the local database and run npm run db:migrate first.");

  const db = getMySqlDb();
  const [existing] = await db.select({ id: users.id, role: users.role }).from(users).where(
    // Email is normalized to lower case on write.
    (await import("drizzle-orm")).eq(users.email, email),
  ).limit(1);
  if (existing) {
    if (existing.role === "owner") {
      console.log("The configured owner account already exists. No changes were made.");
      return;
    }
    throw new Error("An account already exists for OWNER_EMAIL. Refusing to promote it automatically.");
  }

  const now = new Date();
  await db.insert(users).values({
    id: randomUUID(),
    email,
    passwordHash: await hashPassword(password),
    fullName: "Gallery Owner",
    role: "owner",
    status: "active",
    emailVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  console.log("Initial owner account created. Remove OWNER_PASSWORD from .env now.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Owner creation failed.");
    process.exitCode = 1;
  })
  .finally(async () => closeMySqlPool().catch(() => undefined));
