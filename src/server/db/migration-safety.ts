export const DRIZZLE_MIGRATION_JOURNAL = "__drizzle_migrations";

export type MySqlMigrationInitializationGate =
  | "migration_journal_present"
  | "empty_database_ready_for_migration_review"
  | "blocked_existing_tables_without_migration_journal";

export type MySqlMigrationInitializationState = {
  tableCount: number;
  migrationJournalPresent: boolean;
  schemaInitializationGate: MySqlMigrationInitializationGate;
};

function normalizeTableNames(tableNames: readonly string[]): string[] {
  return [...new Set(tableNames.map((name) => {
    if (typeof name !== "string" || !name.trim()) {
      throw new Error("MySQL returned an empty or invalid table name while checking migration safety.");
    }
    return name.trim().toLowerCase();
  }))];
}

export function inspectMySqlMigrationInitialization(
  tableNames: readonly string[],
): MySqlMigrationInitializationState {
  const normalizedNames = normalizeTableNames(tableNames);
  const migrationJournalPresent = normalizedNames.includes(DRIZZLE_MIGRATION_JOURNAL);

  return {
    tableCount: normalizedNames.length,
    migrationJournalPresent,
    schemaInitializationGate: migrationJournalPresent
      ? "migration_journal_present"
      : normalizedNames.length === 0
        ? "empty_database_ready_for_migration_review"
        : "blocked_existing_tables_without_migration_journal",
  };
}

export function assertMySqlMigrationInitializationAllowed(
  tableNames: readonly string[],
): MySqlMigrationInitializationState {
  const state = inspectMySqlMigrationInitialization(tableNames);
  if (state.schemaInitializationGate === "blocked_existing_tables_without_migration_journal") {
    throw new Error(
      "Refusing to apply MySQL migrations: this database contains " +
        state.tableCount +
        " existing table/view object(s) but has no Drizzle migration journal. " +
        "It may contain legacy or manually created data. Back it up and reconcile the schema, " +
        "or configure a separate empty local database. No database changes were made.",
    );
  }
  return state;
}
