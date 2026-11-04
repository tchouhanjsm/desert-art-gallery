import { describe, expect, it } from "vitest";
import {
  assertMySqlMigrationInitializationAllowed,
  inspectMySqlMigrationInitialization,
} from "./migration-safety";

describe("MySQL migration initialization safety", () => {
  it("allows an empty database to be reviewed for first-time initialization", () => {
    expect(assertMySqlMigrationInitializationAllowed([])).toEqual({
      tableCount: 0,
      migrationJournalPresent: false,
      schemaInitializationGate: "empty_database_ready_for_migration_review",
    });
  });

  it("blocks existing tables when the Drizzle migration journal is missing", () => {
    expect(() =>
      assertMySqlMigrationInitializationAllowed(["legacy_products", "legacy_orders"]),
    ).toThrow(/2 existing table\/view object\(s\).*no Drizzle migration journal/i);
  });

  it("allows a database that already has the migration journal", () => {
    expect(
      assertMySqlMigrationInitializationAllowed([
        "products",
        "product_variants",
        "__drizzle_migrations",
      ]),
    ).toMatchObject({
      tableCount: 3,
      migrationJournalPresent: true,
      schemaInitializationGate: "migration_journal_present",
    });
  });

  it("normalizes MySQL table-name case and rejects malformed introspection rows", () => {
    expect(inspectMySqlMigrationInitialization(["__DRIZZLE_MIGRATIONS"]).migrationJournalPresent).toBe(true);
    expect(() => inspectMySqlMigrationInitialization([""])).toThrow(/invalid table name/i);
  });
});
