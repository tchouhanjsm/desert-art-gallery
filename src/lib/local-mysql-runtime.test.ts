import { describe, expect, it } from "vitest";
import {
  isSupportedMySqlServer,
  parseLocalMySqlConnectionUrl,
} from "./local-mysql-runtime";

describe("native local MySQL runtime", () => {
  it.each([
    "mysql://gallery:secret@localhost:3306/desert_gallery_dev",
    "mysql://gallery:secret@127.0.0.1:3307/desert_gallery_local",
    "mysql://gallery:secret@[::1]:3306/desert_gallery_test",
  ])("accepts loopback database URLs: %s", (url) => {
    expect(parseLocalMySqlConnectionUrl(url).database).toMatch(/^desert_gallery_/);
  });

  it("decodes credentials and applies the default MySQL port", () => {
    expect(parseLocalMySqlConnectionUrl(
      "mysql://gallery%40owner:p%40ss%3Aword@localhost/desert_gallery_dev",
    )).toEqual({
      host: "localhost",
      port: 3306,
      user: "gallery@owner",
      password: "p@ss:word",
      database: "desert_gallery_dev",
    });
  });

  it.each([
    "mysql://gallery:secret@192.0.2.10:3306/desert_gallery_dev",
    "mysql://gallery:secret@db.example.com:3306/desert_gallery_dev",
    "mysql://gallery:secret@localhost:3306/desert_gallery_production",
    "mysql://gallery@localhost:3306/desert_gallery_dev",
    "mysql://gallery:secret@localhost:70000/desert_gallery_dev",
  ])("rejects unsafe or malformed database URLs: %s", (url) => {
    expect(() => parseLocalMySqlConnectionUrl(url)).toThrow();
  });

  it("requires MySQL 8.0.16 or newer", () => {
    expect(isSupportedMySqlServer("8.0.16", "MySQL Community Server - GPL")).toBe(true);
    expect(isSupportedMySqlServer("8.0.36-commercial", "MySQL Enterprise Server")).toBe(true);
    expect(isSupportedMySqlServer("8.4.0", "MySQL Community Server - GPL")).toBe(true);
    expect(isSupportedMySqlServer("8.0.15", "MySQL Community Server - GPL")).toBe(false);
    expect(isSupportedMySqlServer("5.7.44", "MySQL Community Server - GPL")).toBe(false);
    expect(isSupportedMySqlServer("10.11.2-MariaDB", "MariaDB Server")).toBe(false);
    expect(isSupportedMySqlServer("unknown", "")).toBe(false);
  });
});
