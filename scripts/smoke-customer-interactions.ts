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
const fixtureMode = process.env.STOREFRONT_REVIEW_FIXTURES === "true";
const fixtureProductSlug = "ci-review-product";
const fixtureCollectionSlug = "ci-review-collection";
const fixtureProductName = "CI review fixture — not for sale";
const fixtureVariantId = "00000000-0000-4000-8000-000000000204";

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
    const navigationPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const navigationPrefetches: string[] = [];
    navigationPage.on("request", (request) => {
      try {
        const requestUrl = new URL(request.url());
        if (requestUrl.searchParams.has("_rsc")) navigationPrefetches.push(requestUrl.pathname);
      } catch {
        // Ignore non-URL request values; Playwright normally supplies absolute URLs.
      }
    });
    try {
      await navigationPage.goto(new URL("/shop", baseUrl).toString(), { waitUntil: "domcontentloaded" });
      await navigationPage.locator("footer").scrollIntoViewIfNeeded();
      await navigationPage.waitForTimeout(1_000);
      const sharedNavigationPaths = await navigationPage
        .locator("header a[href], footer a[href]")
        .evaluateAll((anchors) => [...new Set(anchors.map((anchor) => new URL((anchor as HTMLAnchorElement).href).pathname))]);
      const unexpectedPrefetches = [...new Set(navigationPrefetches.filter((path) =>
        sharedNavigationPaths.includes(path) && path !== new URL(baseUrl).pathname,
      ))];
      if (unexpectedPrefetches.length) {
        throw new Error("Shared navigation destinations were prefetched before activation: " + unexpectedPrefetches.join(", "));
      }
      await navigationPage.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Makers", exact: true }).click();
      await navigationPage.waitForURL("**/artisans");
      record(
        "shared-navigation-defers-prefetch",
        "Header and footer destinations do not prefetch route payloads before activation; a navigation click still opens its destination",
        "passed",
      );
    } catch (error) {
      record(
        "shared-navigation-defers-prefetch",
        "Header and footer destinations do not prefetch route payloads before activation; a navigation click still opens its destination",
        "failed",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      await navigationPage.close();
    }

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
    if (fixtureMode) {
      await runCheck(
        browser,
        "published-product-gallery",
        "A published MySQL product renders both rights-checked CI media images on the real product route",
        { width: 390, height: 844 },
        async (page) => {
          await page.goto(new URL("/products/" + fixtureProductSlug, baseUrl).toString(), { waitUntil: "domcontentloaded" });
          await page.getByRole("heading", { level: 1, name: fixtureProductName }).waitFor({ state: "visible" });
          const galleryImage = page.locator(".detail-gallery-main img").first();
          await galleryImage.waitFor({ state: "visible" });
          await page.waitForFunction(() => {
            const image = document.querySelector(".detail-gallery-main img") as HTMLImageElement | null;
            return Boolean(image && image.complete && image.naturalWidth > 0);
          }, undefined, { timeout: 20_000 });
          const firstAlt = await galleryImage.getAttribute("alt");
          if (!firstAlt?.includes("Synthetic CI illustration")) {
            throw new Error("The primary product image did not retain its descriptive synthetic alt text.");
          }
          await page.getByRole("button", { name: "Product image 2 / 2" }).click();
          await page.waitForFunction(() => {
            const image = document.querySelector(".detail-gallery-main img") as HTMLImageElement | null;
            return Boolean(image && image.complete && image.naturalWidth > 0 && image.alt.includes("alternate view"));
          }, undefined, { timeout: 20_000 });
        },
      );

      await runCheck(
        browser,
        "published-collection-merchandising",
        "A published collection renders its CI-only cover image and linked product card",
        { width: 1280, height: 900 },
        async (page) => {
          await page.goto(new URL("/collections/" + fixtureCollectionSlug, baseUrl).toString(), { waitUntil: "domcontentloaded" });
          const heading = page.getByRole("heading", { level: 1 });
          await heading.waitFor({ state: "visible" });
          if (!(await heading.innerText()).includes("CI review collection")) {
            throw new Error("The published collection heading did not render.");
          }
          await page.getByRole("link", { name: new RegExp(fixtureProductName, "i") }).waitFor({ state: "visible" });
          const cover = page.locator(".atelier-collection-hero img").first();
          await cover.waitFor({ state: "visible" });
          await page.waitForFunction(() => {
            const image = document.querySelector(".atelier-collection-hero img") as HTMLImageElement | null;
            return Boolean(image && image.complete && image.naturalWidth > 0);
          }, undefined, { timeout: 20_000 });
          const alt = await cover.getAttribute("alt");
          if (!alt?.includes("Synthetic geometric CI artwork")) {
            throw new Error("The collection cover did not retain its descriptive synthetic alt text.");
          }
        },
      );

      await runCheck(
        browser,
        "product-to-populated-bag",
        "A customer can select a published option, add the product and see server-priced bag details without creating an order",
        { width: 390, height: 844 },
        async (page) => {
          await page.goto(new URL("/products/" + fixtureProductSlug, baseUrl).toString(), { waitUntil: "domcontentloaded" });
          await page.getByRole("heading", { level: 1, name: fixtureProductName }).waitFor({ state: "visible" });
          await page.getByLabel("Select an option").selectOption(fixtureVariantId);
          await page.getByRole("button", { name: "Add to bag" }).click();
          const dialog = page.getByRole("dialog", { name: "Your bag" });
          await dialog.waitFor({ state: "visible" });
          await dialog.getByRole("heading", { name: fixtureProductName, exact: true }).waitFor({ state: "visible" });
          await dialog.getByText("CI test option", { exact: true }).waitFor({ state: "visible" });
          await page.waitForFunction(() => {
            const details = document.querySelector(".cart-drawer .cart-line-details");
            return Boolean(details && /₹|INR/.test(details.textContent ?? ""));
          }, undefined, { timeout: 20_000 });
          const increment = dialog.getByRole("button", { name: "Increase quantity for " + fixtureProductName });
          await page.waitForFunction(() => {
            const button = [...document.querySelectorAll<HTMLButtonElement>(".cart-drawer button")]
              .find((item) => item.getAttribute("aria-label") === "Increase quantity for CI review fixture — not for sale");
            return Boolean(button && !button.disabled);
          }, undefined, { timeout: 20_000 });
          await increment.click();
          const quantity = dialog.locator(".cart-quantity span").first();
          if ((await quantity.innerText()).trim() !== "2") {
            throw new Error("The test bag did not accept the second in-stock unit.");
          }
          await page.waitForFunction(() => {
            const button = [...document.querySelectorAll<HTMLButtonElement>(".cart-drawer button")]
              .find((item) => item.getAttribute("aria-label") === "Increase quantity for CI review fixture — not for sale");
            return Boolean(button?.disabled);
          }, undefined, { timeout: 20_000 });
        },
      );
    }
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
    fixtureMode,
    limitations: [
      fixtureMode
        ? "The populated-catalogue checks use one clearly labelled synthetic product, one synthetic collection, generated artwork and a throwaway test price in the disposable CI database only."
        : "The default local smoke mode does not seed or require a populated catalogue.",
      "Does not authenticate customers or owners.",
      "Stops at bag preview: it does not submit checkout, create order drafts, reserve inventory or attempt payments.",
      "Generated CI artwork is not merchant photography; real catalogue and rights review remain owner acceptance gates.",
      "Does not replace human visual inspection, keyboard/screen-reader review or authenticated UAT.",
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
