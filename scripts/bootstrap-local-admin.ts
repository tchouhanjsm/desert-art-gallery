import { randomUUID } from "node:crypto";
import { count } from "drizzle-orm";
import { closeMySqlPool, getMySqlDb } from "../src/server/db";
import { adminUsers } from "../src/server/db/schema";
import { hashOwnerPassword } from "../src/server/auth/password";

async function main() {
  const email = process.env.LOCAL_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.LOCAL_ADMIN_PASSWORD ?? "";
  const displayName = process.env.LOCAL_ADMIN_NAME?.trim() ?? "Gallery Owner";
  if (!email || !password) {
    throw new Error("Set LOCAL_ADMIN_EMAIL and LOCAL_ADMIN_PASSWORD before running db:bootstrap-admin.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    throw new Error("LOCAL_ADMIN_EMAIL must be a valid email address of 255 characters or fewer.");
  }
  const passwordHash = hashOwnerPassword(password);
  const db = getMySqlDb();
  const [result] = await db.select({ total: count() }).from(adminUsers);
  if (Number(result?.total ?? 0) > 0) {
    throw new Error("An owner account already exists. Refusing to create another bootstrap account; use the owner access recovery procedure.");
  }
  await db.insert(adminUsers).values({
    id: randomUUID(),
    email,
    displayName: displayName.slice(0, 160) || "Gallery Owner",
    passwordHash,
    role: "owner",
    isActive: true,
    failedLoginCount: 0,
  });
  process.stdout.write("Initial local owner account created. The password hash is stored in MySQL; remove LOCAL_ADMIN_PASSWORD from the environment now.\n");
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "Unable to bootstrap local owner account.") + "\n");
  process.exitCode = 1;
}).finally(async () => {
  await closeMySqlPool().catch(() => undefined);
});
