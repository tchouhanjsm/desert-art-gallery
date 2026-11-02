import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(readFileSync(
  new URL("../../package.json", import.meta.url),
  "utf8",
)) as { dependencies?: Record<string, string> };

describe("self-hosted typography", () => {
  it("does not require a remote Google Fonts fetch during the production build", () => {
    expect(layout).not.toContain("next/font/google");
    expect(layout).toContain("@fontsource-variable/cormorant-garamond");
    expect(layout).toContain("@fontsource-variable/dm-sans");
  });

  it("declares pinned font packages and the CSS family tokens used by the design system", () => {
    expect(packageJson.dependencies?.["@fontsource-variable/cormorant-garamond"]).toBe("5.3.0");
    expect(packageJson.dependencies?.["@fontsource-variable/dm-sans"]).toBe("5.3.0");
    expect(styles).toContain("--font-display:");
    expect(styles).toContain("--font-body:");
  });
});
