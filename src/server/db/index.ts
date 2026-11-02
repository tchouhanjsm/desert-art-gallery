import mysql, { type Pool } from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "./schema";

type DatabaseRuntime = {
  pool?: Pool;
  db?: MySql2Database<typeof schema>;
};

const runtime = globalThis as typeof globalThis & { __desertGalleryDatabase?: DatabaseRuntime };

export function hasMySqlDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function isMySqlCatalogueEnabled(): boolean {
  const enabled = process.env.MYSQL_CATALOGUE_ENABLED?.trim().toLowerCase() === "true";
  if (enabled && !hasMySqlDatabase()) {
    throw new Error("MYSQL_CATALOGUE_ENABLED requires DATABASE_URL to be configured.");
  }
  return enabled;
}

function databaseUrl(): URL {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) throw new Error("DATABASE_URL is required for the MySQL editorial backend.");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL must be a valid MySQL connection URL.");
  }

  if (parsed.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use the mysql:// scheme supported by the Drizzle MySQL migration runner.");
  }
  if (!parsed.hostname || !parsed.username || !parsed.pathname || parsed.pathname === "/") {
    throw new Error("DATABASE_URL must include a host, username and database name.");
  }
  return parsed;
}

export function getMySqlPool(): Pool {
  const current = runtime.__desertGalleryDatabase ?? (runtime.__desertGalleryDatabase = {});
  if (current.pool) return current.pool;

  const url = databaseUrl();
  const database = decodeURIComponent(url.pathname.slice(1));
  current.pool = mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    waitForConnections: true,
    connectionLimit: 5,
    maxIdle: 2,
    idleTimeout: 60_000,
    queueLimit: 10,
    enableKeepAlive: true,
    timezone: "Z",
    charset: "utf8mb4",
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
  return current.pool;
}

export function getMySqlDb(): MySql2Database<typeof schema> {
  const current = runtime.__desertGalleryDatabase ?? (runtime.__desertGalleryDatabase = {});
  if (current.db) return current.db;
  current.db = drizzle(getMySqlPool(), { schema, mode: "default" });
  return current.db;
}

export async function pingMySql(): Promise<boolean> {
  try {
    const [rows] = await getMySqlPool().query("SELECT 1 AS ok");
    return Array.isArray(rows) && rows.length === 1;
  } catch {
    return false;
  }
}

export async function closeMySqlPool(): Promise<void> {
  const current = runtime.__desertGalleryDatabase;
  if (!current?.pool) return;
  await current.pool.end();
  delete current.pool;
  delete current.db;
}
