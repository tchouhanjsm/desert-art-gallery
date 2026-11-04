import { randomUUID } from "node:crypto";
import { closeMySqlPool, getMySqlDb } from "../src/server/db";
import { adminUsers } from "../src/server/db/schema";
import { hashOwnerPassword } from "../src/server/auth/password";

const CONFIRMATION = "CREATE_INITIAL_STAGING_OWNER";

function verifiedStagingDatabaseName(): string {
  if (process.env.APP_ENV?.trim().toLowerCase() !== "staging") {
    throw new Error("Staging owner bootstrap is allowed only when APP_ENV=staging.");
  }
  if (process.env.STAGING_BOOTSTRAP_CONFIRMATION !== CONFIRMATION) {
    throw new Error("Set STAGING_BOOTSTRAP_CONFIRMATION=CREATE_INITIAL_STAGING_OWNER for this one-time operation.");
  }

  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) throw new Error("DATABASE_URL is required.");
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL must be a valid MySQL URL.");
  }
  if (databaseUrl.protocol !== "mysql:" || !databaseUrl.pathname || databaseUrl.pathname === "/") {
    throw new Error("DATABASE_URL must identify a named MySQL database.");
  }

  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  const declaredName = process.env.STAGING_DATABASE_NAME?.trim();
  if (!declaredName || declaredName !== databaseName) {
    throw new Error("STAGING_DATABASE_NAME must exactly match the database name in DATABASE_URL.");
  }
  if (!/(^|[_-])staging($|[_-])/i.test(databaseName)) {
    throw new Error("Refusing bootstrap: the target database name must contain a distinct 'staging' segment.");
  }
  return databaseName;
}

async function main() {
  const databaseName = verifiedStagingDatabaseName();
  const email = process.env.STAGING_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.STAGING_ADMIN_PASSWORD ?? "";
  const displayName = process.env.STAGING_ADMIN_NAME?.trim() ?? "Gallery Staging Owner";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    throw new Error("STAGING_ADMIN_EMAIL must be a valid email address.");
  }
  if (password.length < 12 || password.length > 256) {
    throw new Error("STAGING_ADMIN_PASSWORD must be between 12 and 256 characters.");
  }

  const db = getMySqlDb();
  await db.transaction(async (tx) => {
    const existing = await tx.select({ id: adminUsers.id }).from(adminUsers).limit(1).for("update");
    if (existing.length > 0) {
      throw new Error("A staging admin already exists. Refusing to create another initial owner.");
    }

    await tx.insert(adminUsers).values({
      id: randomUUID(),
      email,
      displayName: displayName.slice(0, 160) || "Gallery Staging Owner",
      passwordHash: hashOwnerPassword(password),
      role: "owner",
      isActive: true,
      failedLoginCount: 0,
    });
  });

  process.stdout.write("Initial staging owner created in the verified staging database: " + databaseName + ".\n");
  process.stdout.write("Remove STAGING_ADMIN_PASSWORD and STAGING_BOOTSTRAP_CONFIRMATION from the deployment environment now.\n");
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "Unable to bootstrap staging owner.") + "\n");
  process.exitCode = 1;
}).finally(async () => {
  delete process.env.STAGING_ADMIN_PASSWORD;
  delete process.env.STAGING_BOOTSTRAP_CONFIRMATION;
  await closeMySqlPool().catch(() => undefined);
});
