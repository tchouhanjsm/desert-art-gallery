import { assertLocalMySqlTarget } from "../server/db/safety";

export const MINIMUM_MYSQL_VERSION = "8.0.16";

export type LocalMySqlConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

export function parseLocalMySqlConnectionUrl(raw: string): LocalMySqlConnectionConfig {
  const database = assertLocalMySqlTarget(raw);
  const url = new URL(raw.trim());
  const port = Number(url.port || 3306);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DATABASE_URL must contain a valid MySQL TCP port.");
  }

  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  if (!user || !password) {
    throw new Error("DATABASE_URL must include a local database username and password.");
  }

  return {
    host: url.hostname.replace(/^\\[|\\]$/g, ""),
    port,
    user,
    password,
    database,
  };
}

function versionParts(value: string): [number, number, number] | null {
  const match = value.match(/(?:^|[^0-9])(\\d+)\\.(\\d+)\\.(\\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isSupportedMySqlServer(version: string, versionComment = ""): boolean {
  if (/mariadb/i.test(version + " " + versionComment)) return false;

  const actual = versionParts(version);
  const minimum = versionParts(MINIMUM_MYSQL_VERSION);
  if (!actual || !minimum) return false;

  if (actual[0] !== minimum[0]) return actual[0] > minimum[0];
  if (actual[1] !== minimum[1]) return actual[1] > minimum[1];
  return actual[2] >= minimum[2];
}
