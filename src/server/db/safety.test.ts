import { afterEach, describe, expect, it } from "vitest";
import { assertCatalogueImportEnvironmentAllowed, assertLocalMySqlTarget } from "./safety";

const original = process.env.DATABASE_URL;

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
});

describe("local MySQL write safety", () => {
  it.each([
    "mysql://user:pass@localhost:3306/desert_gallery_dev",
    "mysql://user:pass@127.0.0.1:3306/desert_gallery_test",
    "mysql://user:pass@[::1]:3306/desert_gallery_local",
  ])("allows a loopback MySQL target: %s", (databaseUrl) => {
    expect(assertLocalMySqlTarget(databaseUrl)).toMatch(/^desert_gallery_/);
  });

  it.each([
    "mysql://user:pass@db.hostinger.com:3306/desert_gallery",
    "mysql://user:pass@192.0.2.10:3306/desert_gallery_local",
    "mysql://user:pass@localhost:3306/desert_gallery_production",
  ])("blocks a remote or production-looking target: %s", (databaseUrl) => {
    expect(() => assertLocalMySqlTarget(databaseUrl)).toThrow();
  });

  it("blocks a missing or malformed database URL", () => {
    expect(() => assertLocalMySqlTarget("")).toThrow("DATABASE_URL is required");
    expect(() => assertLocalMySqlTarget("not-a-database-url")).toThrow("valid MySQL URL");
  });
});

describe("catalogue import environment gate", () => {
  it("allows local development and test imports", () => {
    expect(() => assertCatalogueImportEnvironmentAllowed({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertCatalogueImportEnvironmentAllowed({ NODE_ENV: "test" })).not.toThrow();
  });

  it("blocks production catalogue writes by default", () => {
    expect(() => assertCatalogueImportEnvironmentAllowed({ NODE_ENV: "production" })).toThrow(/disabled in production/i);
    expect(() => assertCatalogueImportEnvironmentAllowed({
      NODE_ENV: "production",
      APP_ENV: "production",
      STAGING_CATALOGUE_IMPORT_ENABLED: "true",
    })).toThrow(/disabled in production/i);
  });

  it("allows staging writes only with both explicit staging controls", () => {
    expect(() => assertCatalogueImportEnvironmentAllowed({
      NODE_ENV: "production",
      APP_ENV: "staging",
      STAGING_CATALOGUE_IMPORT_ENABLED: "true",
    })).not.toThrow();
    expect(() => assertCatalogueImportEnvironmentAllowed({
      NODE_ENV: "production",
      APP_ENV: "staging",
      STAGING_CATALOGUE_IMPORT_ENABLED: "false",
    })).toThrow(/disabled in production/i);
  });
});
