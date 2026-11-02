import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  hasMySqlDatabase: vi.fn(),
  pingMySql: vi.fn(),
  query: vi.fn(),
}));

vi.mock("../../../server/db", () => ({
  hasMySqlDatabase: databaseMocks.hasMySqlDatabase,
  pingMySql: databaseMocks.pingMySql,
  getMySqlPool: () => ({ query: databaseMocks.query }),
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.hasMySqlDatabase.mockReturnValue(true);
    databaseMocks.pingMySql.mockResolvedValue(true);
    databaseMocks.query.mockResolvedValue([[{ migration_count: 3 }]]);
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
      },
    });
    expect(databaseMocks.pingMySql).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
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
