export function assertLocalMySqlTarget(databaseUrl = process.env.DATABASE_URL): string {
  if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is required.");
  let url: URL;
  try {
    url = new URL(databaseUrl.trim());
  } catch {
    throw new Error("DATABASE_URL must be a valid MySQL URL.");
  }
  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must use the mysql:// protocol.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!localHosts.has(host)) {
    throw new Error("This operation is restricted to a local MySQL instance (localhost, 127.0.0.1 or ::1). Remote database hosts are blocked.");
  }
  if (!url.pathname || url.pathname === "/") throw new Error("DATABASE_URL must point to a named MySQL database.");
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database || /(^|[-_])(prod|production|live|hostinger)([-_]|$)/i.test(database)) {
    throw new Error("This operation is blocked for production/live/Hostinger database names.");
  }
  return database;
}
