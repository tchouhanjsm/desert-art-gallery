import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

type InteractionResult = {
  id: string;
  description: string;
  status: "passed" | "failed";
  detail?: string;
};

const baseUrl = new URL(
  process.env.STOREFRONT_INTERACTION_BASE_URL ??
  process.env.STOREFRONT_REVIEW_BASE_URL ??
  "http://localhost:4174",
);
const outputDirectory = resolve(
  process.env.STOREFRONT_INTERACTION_OUTPUT_DIR ?? ".local-data/interaction-review",
);
const results: InteractionResult[] = [];

function record(id: string, description: string, status: InteractionResult["status"], detail?: string) {
  results.push({ id, description, status, ...(detail ? { detail } : {}) });
}

async function runCheck(
  browser: Browser,
  id: string,
  description: string,
  viewport: { width: number; height: number },
  check: (page: Page) => Promise<void>,
): Promise<void> {
  const page = await browser.newPage({ viewport });
  try {
    await page.goto(new URL("/shop", baseUrl).toString(), { waitUntil: "domcontentloaded" });
    await check(page);
    record(id, description, "passed");
  } catch (error) {
    record(
      id,
      description,
      "failed",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    await page.close();
  }
}

async function main(): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  const healthUrl = new URL("/api/health", baseUrl);
  const healthResponse = await fetch(healthUrl, { signal: AbortSignal.timeout(12_000) });
  if (!healthResponse.ok) {
    throw new Error(`Application health check failed (${healthResponse.status}) at ${healthUrl}`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    await runCheck(
      browser,
      "shop-search-submit",
      "Header search submits the search term to the shop URL",
      { width: 1280, height: 900 },
      async (page) => {
        const search = page.locator("#site-product-search");
        await search.fill("indigo");
        await page.getByRole("button", { name: "Search", exact: true }).click();
        await page.waitForURL(/\/shop\?q=indigo/);
        if (await page.locator("#shop-search").inputValue() !== "indigo") {
          throw new Error("Shop search did not hydrate the submitted query.");
        }
      },
    );

    await runCheck(
      browser,
      "shop-query-hydration",
      "Shop search query remains visible when the shop URL is opened directly",
      { width: 1280, height: 900 },
      async (page) => {
        await page.goto(new URL("/shop?q=handmade", baseUrl).toString(), { waitUntil: "domcontentloaded" });
        const search = page.locator("#shop-search");
        await search.waitFor({ state: "visible" });
        if (await search.inputValue() !== "handmade") {
          throw new Error("The query parameter was not hydrated into the shop search field.");
        }
      },
    );

    await runCheck(
      browser,
      "mobile-menu-escape",
      "Mobile navigation opens, exposes its expanded state and closes with Escape",
      { width: 390, height: 844 },
      async (page) => {
        const menuButton = page.getByRole("button", { name: "Open menu" });
        await menuButton.click();
        const openButton = page.getByRole("button", { name: "Close menu" });
        if (await openButton.getAttribute("aria-expanded") !== "true") {
          throw new Error("Mobile menu did not expose aria-expanded=true.");
        }
        await page.keyboard.press("Escape");
        const closedButton = page.getByRole("button", { name: "Open menu" });
        if (await closedButton.getAttribute("aria-expanded") !== "false") {
          throw new Error("Escape did not close the mobile menu.");
        }
        if (await closedButton.evaluate((element) => document.activeElement === element) !== true) {
          throw new Error("Focus was not restored to the mobile menu trigger.");
        }
      },
    );

    await runCheck(
      browser,
      "empty-bag-dialog",
      "Shopping bag opens as an accessible empty dialog and closes with Escape",
      { width: 390, height: 844 },
      async (page) => {
        const trigger = page.getByRole("button", { name: "Shopping bag, 0 items" });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Your bag" });
        await dialog.waitFor({ state: "visible" });
        if (await dialog.getAttribute("aria-modal") !== "true") {
          throw new Error("Shopping bag dialog is not modal.");
        }
        if (!(await dialog.getByText("Your bag is empty.").isVisible())) {
          throw new Error("The empty bag state is not visible.");
        }
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        if (await trigger.evaluate((element) => document.activeElement === element) !== true) {
          throw new Error("Focus was not restored to the shopping bag trigger.");
        }
      },
    );
  } finally {
    await browser.close();
  }

  const failed = results.filter((result) => result.status === "failed");
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA ?? null,
    baseUrl: baseUrl.toString(),
    checkCount: results.length,
    failedCount: failed.length,
    results,
    limitations: [
      "Uses an empty CI catalogue; does not add products or modify merchant data.",
      "Does not authenticate customers or owners.",
      "Does not submit checkout, create orders, reserve stock or attempt payments.",
      "Does not replace human visual inspection or authenticated UAT.",
    ],
  };
  await writeFile(
    resolve(outputDirectory, "interaction-manifest.json"),
    JSON.stringify(report, null, 2) + "\n",
    "utf8",
  );
  console.log(`Customer interaction checks: ${results.length - failed.length}/${results.length} passed.`);
  if (failed.length) {
    for (const result of failed) console.error(`FAIL ${result.id}: ${result.detail}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
