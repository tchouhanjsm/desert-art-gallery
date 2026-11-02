import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
const envExample = readFileSync(join(root, ".env.example"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("native local MySQL development contract", () => {
  it("does not expose local Docker or Compose commands", () => {
    expect(existsSync(join(root, "compose.yaml"))).toBe(false);
    for (const name of ["db:up", "db:stop", "db:logs"]) {
      expect(packageJson.scripts[name]).toBeUndefined();
    }
    expect(Object.values(packageJson.scripts).join("\n")).not.toMatch(/docker|compose/i);
  });

  it("provides native database diagnostics and private workspace preparation", () => {
    expect(packageJson.scripts["local:prepare"]).toContain("prepare-local-workspace.ts");
    expect(packageJson.scripts["db:ping"]).toContain("mysql-status.ts --ping");
    expect(packageJson.scripts["db:status"]).toContain("mysql-status.ts");
    expect(packageJson.scripts["db:migrate"]).toContain("migrate-mysql.ts");
    expect(gitignore.split(/\r?\n/)).toContain(".local-data/");
  });

  it("keeps only a local DATABASE_URL template and no Compose root credentials", () => {
    expect(envExample).toContain("DATABASE_URL=mysql://dag_local:");
    expect(envExample).toContain("NEXT_PUBLIC_SITE_URL=http://localhost:3000");
    expect(envExample).not.toMatch(/MYSQL_ROOT_PASSWORD|MYSQL_HOST_PORT|REPLACE_WITH_ANOTHER/);
    expect(envExample).not.toContain("desertartgallery.net");
  });

  it("loads a local env file in the migration entry point without requiring one in CI", () => {
    const migration = readFileSync(join(root, "scripts", "migrate-mysql.ts"), "utf8");
    expect(migration).toContain('if (existsSync(".env"))');
    expect(migration).toContain('process.loadEnvFile(".env")');
  });

  it("prepares a read-only, private product-image intake workflow", () => {
    expect(packageJson.scripts["media:preview"]).toContain("preview-product-images.ts");
    const preview = readFileSync(join(root, "scripts", "preview-product-images.ts"), "utf8");
    expect(preview).toContain(".local-data");
    expect(preview).toContain("No files were uploaded");
  });
});
