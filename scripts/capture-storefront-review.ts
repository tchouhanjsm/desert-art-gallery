import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { chromium } from "playwright";
import { isExpectedNavigationAbort, storefrontReviewRoutes, storefrontReviewViewports } from "../src/lib/storefront-review";

type CaptureRecord = {
  routeId: string;
  routePath: string;
  area: "customer" | "operations";
  viewportId: string;
  width: number;
  height: number;
  status: number | null;
  finalUrl: string;
  title: string;
  documentLanguage: string;
  screenshot: string | null;
  horizontalOverflow: boolean | null;
  h1Count: number | null;
  imagesWithoutAlt: number | null;
  brokenImages: number | null;
  buttonsWithoutAccessibleName: number | null;
  httpErrors: string[];
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  error: string | null;
};

const baseUrl = new URL(
  process.env.STOREFRONT_REVIEW_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3000",
);
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outputDirectory = resolve(
  process.env.STOREFRONT_REVIEW_OUTPUT_DIR ?? `.local-data/visual-review/${timestamp}`,
);
const manifestPath = resolve(outputDirectory, "manifest.json");
const records: CaptureRecord[] = [];
const failures: string[] = [];

function isAcceptedStatus(status: number, allowed: readonly number[]): boolean {
  return allowed.includes(status);
}

async function main(): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });

  const healthUrl = new URL("/api/health", baseUrl);
  const healthResponse = await fetch(healthUrl, { signal: AbortSignal.timeout(12_000) });
  if (!healthResponse.ok) {
    const body = await healthResponse.text().catch(() => "");
    throw new Error(
      `Application health check failed (${healthResponse.status}) at ${healthUrl}: ${body.slice(0, 500)}`,
    );
  }

  const health = await healthResponse.json().catch(() => null);
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(60_000);

    let activeRecord: CaptureRecord | null = null;
    const requestOwners = new WeakMap<import("playwright").Request, CaptureRecord>();
    page.on("request", (request) => {
      if (activeRecord) requestOwners.set(request, activeRecord);
    });
    page.on("response", (response) => {
      const owner = requestOwners.get(response.request()) ?? activeRecord;
      if (owner && response.status() >= 400 && !response.request().isNavigationRequest()) {
        owner.httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });
    page.on("console", (message) => {
      if (message.type() === "error" && activeRecord) {
        activeRecord.consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      activeRecord?.pageErrors.push(error.message);
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText ?? "request failed";
      if (isExpectedNavigationAbort(failure)) return;
      const owner = requestOwners.get(request) ?? activeRecord;
      owner?.failedRequests.push(`${request.method()} ${request.url()} — ${failure}`);
    });

    for (const route of storefrontReviewRoutes) {
      for (const viewport of storefrontReviewViewports) {
        const record: CaptureRecord = {
          routeId: route.id,
          routePath: route.path,
          area: route.area,
          viewportId: viewport.id,
          width: viewport.width,
          height: viewport.height,
          status: null,
          finalUrl: "",
          title: "",
          documentLanguage: "",
          screenshot: null,
          horizontalOverflow: null,
          h1Count: null,
          imagesWithoutAlt: null,
          brokenImages: null,
          buttonsWithoutAccessibleName: null,
          httpErrors: [],
          consoleErrors: [],
          pageErrors: [],
          failedRequests: [],
          error: null,
        };
        activeRecord = record;
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        const targetUrl = new URL(route.path, baseUrl).toString();
        try {
          const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
          if (!response) {
            throw new Error("Navigation completed without a main-document response.");
          }

          record.status = response.status();
          record.finalUrl = page.url();
          await page.evaluate(async () => {
            if (document.fonts) await document.fonts.ready;
          });
          await page.waitForTimeout(120);

          const metrics = await page.evaluate(() => {
            const buttons = [...document.querySelectorAll("button")];
            return {
              title: document.title,
              documentLanguage: document.documentElement.lang,
              horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
              h1Count: document.querySelectorAll("h1").length,
              imagesWithoutAlt: document.querySelectorAll("img:not([alt])").length,
              brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth === 0).length,
              buttonsWithoutAccessibleName: buttons.filter((button) => {
                const label = button.getAttribute("aria-label")?.trim();
                const title = button.getAttribute("title")?.trim();
                return !label && !title && !button.innerText.trim();
              }).length,
            };
          });

          record.title = metrics.title;
          record.documentLanguage = metrics.documentLanguage;
          record.horizontalOverflow = metrics.horizontalOverflow;
          record.h1Count = metrics.h1Count;
          record.imagesWithoutAlt = metrics.imagesWithoutAlt;
          record.brokenImages = metrics.brokenImages;
          record.buttonsWithoutAccessibleName = metrics.buttonsWithoutAccessibleName;

          const screenshotName = `${route.id}--${viewport.id}.png`;
          const screenshotPath = resolve(outputDirectory, screenshotName);
          await mkdir(dirname(screenshotPath), { recursive: true });
          await page.screenshot({
            path: screenshotPath,
            fullPage: true,
            animations: "disabled",
          });
          record.screenshot = relative(outputDirectory, screenshotPath);

          if (!isAcceptedStatus(record.status, route.allowedStatuses)) {
            failures.push(
              `${route.path} at ${viewport.width}px returned ${record.status}; allowed: ${route.allowedStatuses.join(", ")}`,
            );
          }
        } catch (error) {
          record.error = error instanceof Error ? error.message : String(error);
          failures.push(`${route.path} at ${viewport.width}px: ${record.error}`);
        }

        records.push(record);
        console.log(
          `[${record.status ?? "ERR"}] ${route.path} @ ${viewport.width}px${record.screenshot ? ` → ${record.screenshot}` : ""}`,
        );
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA ?? null,
    baseUrl: baseUrl.toString(),
    health,
    routeCount: storefrontReviewRoutes.length,
    viewportCount: storefrontReviewViewports.length,
    captureCount: records.length,
    failedCaptureCount: failures.length,
    failures,
    limitations: [
      "This is an unauthenticated route and layout smoke review; it does not exercise signed-in customer or owner workflows.",
      "CI uses a blank test database. Dynamic product and collection routes may correctly return 404 until approved merchant records exist.",
      "A screenshot is evidence for human review, not automatic visual sign-off or native-speaker/accessibility acceptance.",
      "No product data, media, rights, prices, policies or customer records are created by this script.",
    ],
    records,
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`Visual review manifest: ${manifestPath}`);
  console.log(`Captured ${records.length} route/viewport combinations; failures: ${failures.length}`);

  if (failures.length > 0) process.exitCode = 1;
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      commit: process.env.GITHUB_SHA ?? null,
      baseUrl: baseUrl.toString(),
      fatalError: message,
      records,
    }, null, 2) + "\n",
    "utf8",
  );
  console.error(message);
  process.exitCode = 1;
});
