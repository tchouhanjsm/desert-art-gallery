import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const sourceRoots = ["src/app", "src/components"];

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolutePath);
    return [absolutePath];
  });
}

describe("storefront CSS ownership", () => {
  it("keeps global stylesheet imports in the root App Router layout only", () => {
    const imports = sourceRoots.flatMap((root) =>
      listSourceFiles(resolve(repositoryRoot, root))
        .filter((file) => [".ts", ".tsx"].includes(extname(file)))
        .flatMap((file) => {
          const source = readFileSync(file, "utf8");
          const specifiers = [...source.matchAll(/^\s*import\s+["']([^"']+\.css)["'];?\s*$/gm)]
            .map((match) => match[1]);
          return specifiers.map((specifier) => ({
            file: relative(repositoryRoot, file).replace(/\\/g, "/"),
            specifier,
          }));
        }),
    );

    expect(imports).toEqual([
      { file: "src/app/layout.tsx", specifier: "./globals.css" },
      { file: "src/app/layout.tsx", specifier: "@/styles/japan-storefront.css" },
      { file: "src/app/layout.tsx", specifier: "@/styles/admin-theme.css" },
    ]);
  });

  it("retains the three active stylesheet owners and no superseded theme layers", () => {
    const active = [
      "src/app/globals.css",
      "src/styles/japan-storefront.css",
      "src/styles/admin-theme.css",
    ];
    const retired = [
      "src/styles/theme.css",
      "src/styles/phase1.css",
      "src/styles/editorial.css",
      "src/styles/admin.css",
    ];

    for (const file of active) {
      expect(existsSync(resolve(repositoryRoot, file)), file).toBe(true);
    }
    for (const file of retired) {
      expect(existsSync(resolve(repositoryRoot, file)), file).toBe(false);
    }
  });
});
