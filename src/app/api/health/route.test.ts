import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  hasMySqlDatabase: vi.fn(),
  pingMySql: vi.fn(),
  query: vi.fn(),
  validateMediaStorageConfiguration: vi.fn(),
}));

vi.mock("../../../server/db", () => ({
  hasMySqlDatabase: databaseMocks.hasMySqlDatabase,
  pingMySql: databaseMocks.pingMySql,
  getMySqlPool: () => ({ query: databaseMocks.query }),
}));

vi.mock("../../../server/media/object-storage", () => ({
  validateMediaStorageConfiguration: databaseMocks.validateMediaStorageConfiguration,
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.hasMySqlDatabase.mockReturnValue(true);
    databaseMocks.pingMySql.mockResolvedValue(true);
    databaseMocks.query.mockResolvedValue([[{ migration_count: 3 }]]);
    databaseMocks.validateMediaStorageConfiguration.mockReturnValue("local");
  });

  it("reports missing local database configuration without leaking environment details", async () => {
    databaseMocks.hasMySqlDatabase.mockReturnValue(false);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "degraded",
      checks: {
        application: "ok",
        database: "not_configured",
        migrations: "not_checked",
        mediaStorage: "configured",
      },
    });
    expect(databaseMocks.pingMySql).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("blocks readiness when private media storage is misconfigured without leaking details", async () => {
    databaseMocks.validateMediaStorageConfiguration.mockImplementation(() => {
      throw new Error("s3 secret or endpoint must never be returned");
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      status: "degraded",
      checks: {
        application: "ok",
        database: "not_checked",
        migrations: "not_checked",
        mediaStorage: "misconfigured",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("s3 secret");
    expect(databaseMocks.pingMySql).not.toHaveBeenCalled();
    expect(databaseMocks.query).not.toHaveBeenCalled();
  });

  it("reports an unavailable local database", async () => {
    databaseMocks.pingMySql.mockResolvedValue(false);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: "degraded",
      checks: { database: "unavailable", migrations: "not_checked" },
    });
    expect(databaseMocks.query).not.toHaveBeenCalled();
  });

  it("reports a healthy migrated application and database", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      checks: {
        application: "ok",
        database: "connected",
        migrations: "applied",
        mediaStorage: "configured",
      },
    });
  });

  it("reports an unmigrated database without exposing SQL errors", async () => {
    databaseMocks.query.mockRejectedValue(new Error("private database error"));

    const response = await GET();

    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toContain('"migrations":"pending"');
    expect(body).not.toContain("private database error");
    expect(body).not.toContain("DATABASE_URL");
  });

  it("does not consider an empty migration journal ready", async () => {
    databaseMocks.query.mockResolvedValue([[{ migration_count: 0 }]]);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: "degraded",
      checks: { database: "connected", migrations: "pending" },
    });
  });
});
