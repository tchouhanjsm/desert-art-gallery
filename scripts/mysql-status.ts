import { existsSync } from "node:fs";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { isSupportedMySqlServer, parseLocalMySqlConnectionUrl } from "../src/lib/local-mysql-runtime";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

type ServerRow = RowDataPacket & {
  server_version: string;
  server_comment: string;
  database_name: string;
};

type CountRow = RowDataPacket & { total: number | string };

async function main() {
  const rawUrl = process.env.DATABASE_URL?.trim();
  if (!rawUrl) {
    throw new Error("DATABASE_URL is missing. Configure a local MySQL connection in .env.");
  }

  const config = parseLocalMySqlConnectionUrl(rawUrl);
  const connection = await mysql.createConnection({
    ...config,
    connectTimeout: 5_000,
    enableKeepAlive: true,
    timezone: "Z",
    charset: "utf8mb4",
  });

  try {
    const pingOnly = process.argv.includes("--ping");
    if (pingOnly) {
      await connection.query("SELECT 1 AS ok");
      process.stdout.write("MySQL connection: reachable (local loopback)\\n");
      return;
    }

    const [serverRows] = await connection.query<ServerRow[]>(
      "SELECT VERSION() AS server_version, @@version_comment AS server_comment, DATABASE() AS database_name",
    );
    const server = serverRows[0];
    if (!server) throw new Error("MySQL returned no server identity.");

    process.stdout.write("Database: connected (" + server.database_name + ")\\n");
    process.stdout.write("Server: " + server.server_version + " — " + server.server_comment + "\\n");

    if (!isSupportedMySqlServer(server.server_version, server.server_comment)) {
      throw new Error("This project requires Oracle MySQL 8.0.16 or newer. MariaDB and older MySQL versions are not accepted by the current schema contract.");
    }

    const [journalRows] = await connection.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '__drizzle_migrations'",
    );
    const journalExists = Number(journalRows[0]?.total ?? 0) > 0;

    if (!journalExists) {
      process.stdout.write("Migrations: pending (migration journal not found; run npm run db:migrate)\\n");
      process.exitCode = 2;
      return;
    }

    const [migrationRows] = await connection.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM __drizzle_migrations",
    );
    const migrationCount = Number(migrationRows[0]?.total ?? 0);
    if (migrationCount < 1) {
      process.stdout.write("Migrations: pending (journal is empty; run npm run db:migrate)\\n");
      process.exitCode = 2;
      return;
    }

    process.stdout.write("Migrations: applied (" + migrationCount + " journal entries)\\n");
  } finally {
    await connection.end();
  }
}

function safeConnectionError(error: unknown): Error {
  const code = (error as { code?: string } | null)?.code;
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND") {
    return new Error("Cannot reach the configured local MySQL server. Start the native MySQL service and check its host and port.");
  }
  if (code === "ER_ACCESS_DENIED_ERROR") {
    return new Error("MySQL rejected the local database credentials. Check the username and password in .env; credentials are never printed.");
  }
  if (code === "ER_BAD_DB_ERROR") {
    return new Error("The configured local MySQL database does not exist. Create the database and grant the application user access before retrying.");
  }
  return new Error("Unable to verify the local MySQL database" + (code ? " (" + code + ")." : ".") + " Check the local service, database grants and connection settings.");
}

main().catch((error: unknown) => {
  const safeError = error instanceof Error && [
    "DATABASE_URL is missing.",
    "DATABASE_URL must",
    "This project requires",
    "MySQL returned",
  ].some((prefix) => error.message.startsWith(prefix))
    ? error
    : safeConnectionError(error);
  process.stderr.write(safeError.message + "\\n");
  if (process.exitCode === undefined || process.exitCode === 0) process.exitCode = 1;
});
