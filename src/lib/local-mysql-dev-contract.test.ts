import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const compose = readFileSync(join(root, "compose.yaml"), "utf8");
const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
const envExample = readFileSync(join(root, ".env.example"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("project-local MySQL development contract", () => {
  it("binds the MySQL port to loopback only", () => {
    expect(compose).toContain('127.0.0.1:${MYSQL_HOST_PORT:-3306}:3306');
    expect(compose).not.toContain("0.0.0.0:");
  });

  it("stores the physical database inside the ignored project workspace", () => {
    expect(compose).toContain("./.local-data/mysql:/var/lib/mysql");
    expect(gitignore.split(/\r?\n/)).toContain(".local-data/");
  });

  it("keeps local credentials out of the tracked environment template", () => {
    expect(envExample).toContain("REPLACE_WITH_A_UNIQUE_48_CHARACTER_HEX_SECRET");
    expect(envExample).toContain("MYSQL_ROOT_PASSWORD=REPLACE_WITH_A_UNIQUE_48_CHARACTER_HEX_SECRET");
    expect(envExample).toContain("MYSQL_PASSWORD=REPLACE_WITH_ANOTHER_UNIQUE_48_CHARACTER_HEX_SECRET");
    expect(envExample).toContain("NEXT_PUBLIC_SITE_URL=http://localhost:3000");
    expect(envExample).not.toContain("desertartgallery.net");
  });

  it("provides non-destructive database lifecycle commands", () => {
    expect(packageJson.scripts["db:up"]).toBe("docker compose up -d mysql");
    expect(packageJson.scripts["db:stop"]).toBe("docker compose stop mysql");
    expect(packageJson.scripts["db:status"]).toBe("docker compose ps mysql");
    expect(packageJson.scripts["db:logs"]).toBe("docker compose logs --tail=100 mysql");
  });

  it("loads a local env file from the migration entry point without requiring one in CI", () => {
    const migration = readFileSync(join(root, "scripts", "migrate-mysql.ts"), "utf8");
    expect(migration).toContain('if (existsSync(".env"))');
    expect(migration).toContain('process.loadEnvFile(".env")');
  });
});
