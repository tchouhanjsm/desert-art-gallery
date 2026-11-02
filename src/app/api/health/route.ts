import { NextResponse } from "next/server";
import { getMySqlPool, hasMySqlDatabase, pingMySql } from "@/server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function healthResponse(
  status: "ok" | "degraded",
  checks: {
    application: "ok";
    database: "connected" | "not_configured" | "unavailable";
    migrations: "applied" | "pending" | "not_checked";
  },
  httpStatus: 200 | 503,
) {
  return NextResponse.json(
    { status, checks },
    {
      status: httpStatus,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function GET() {
  if (!hasMySqlDatabase()) {
    return healthResponse("degraded", {
      application: "ok",
      database: "not_configured",
      migrations: "not_checked",
    }, 503);
  }

  if (!(await pingMySql())) {
    return healthResponse("degraded", {
      application: "ok",
      database: "unavailable",
      migrations: "not_checked",
    }, 503);
  }

  try {
    const [rows] = await getMySqlPool().query(
      "SELECT COUNT(*) AS migration_count FROM __drizzle_migrations",
    );
    const migrationCount = Array.isArray(rows)
      ? Number((rows[0] as { migration_count?: number | string } | undefined)?.migration_count ?? 0)
      : 0;
    const migrationsApplied = Number.isFinite(migrationCount) && migrationCount > 0;

    return healthResponse(
      migrationsApplied ? "ok" : "degraded",
      {
        application: "ok",
        database: "connected",
        migrations: migrationsApplied ? "applied" : "pending",
      },
      migrationsApplied ? 200 : 503,
    );
  } catch {
    // Keep database errors, host details and schema internals out of the public response.
    return healthResponse("degraded", {
      application: "ok",
      database: "connected",
      migrations: "pending",
    }, 503);
  }
}
