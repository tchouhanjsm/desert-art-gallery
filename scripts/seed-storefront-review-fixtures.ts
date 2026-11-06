import { eq } from "drizzle-orm";
import { closeMySqlPool, getMySqlDb } from "../src/server/db";
import {
  collections, collectionProductLinks, productCategories, productCategoryLinks,
  productMedia, products, productVariants,
} from "../src/server/db/schema";
import { getPublishedProductBySlug } from "../src/server/catalogue/repository";
import { getPublishedCollections } from "../src/server/editorial/repository";
import { storeProductMedia } from "../src/server/media/product-storage";
import { storeEditorialMedia } from "../src/server/media/storage";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000201";
const CATEGORY_ID = "00000000-0000-4000-8000-000000000202";
const COLLECTION_ID = "00000000-0000-4000-8000-000000000203";
const VARIANT_ID = "00000000-0000-4000-8000-000000000204";
const PRIMARY_MEDIA_ID = "00000000-0000-4000-8000-000000000205";
const SECONDARY_MEDIA_ID = "00000000-0000-4000-8000-000000000206";
const COLLECTION_LINK_ID = "00000000-0000-4000-8000-000000000207";
const PRODUCT_SLUG = "ci-review-product";
const COLLECTION_SLUG = "ci-review-collection";
const PRODUCT_NAME = "CI review fixture — not for sale";
const COLLECTION_NAME = "CI review collection — not for sale";
const RIGHTS_EVIDENCE = "Synthetic geometric artwork generated for the disposable GitHub Actions storefront-review fixture. Not merchant photography.";

const PRIMARY_PNG = "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";
const SECONDARY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAHgAAACgCAIAAABIaz/HAAADy0lEQVR4nO3cPU5bURTE8QPKHtgDJWuhYgXInQUSroygepFA7qysgIotsAUXFLAGdpHiSMgytnlfd86c++bfJkoeP40uDjf2yef7m6nynUY/wFQSNChBgxI0KEGDEjQoQYMSNChBg/pz/JfvmmfMc9TR38XNoV/SokEJGpSgQf1yRm935ACaci2/jWnRoAQNStCgBA1K0KAEDUrQoAQNStCgOvzL0Mw+Xv4Veo6knV9dt/ydWjQoQYMSNKhuZ3T7I0ntpEWDEjQoQYMSNChBgxI0qJTQj7cP0Y/QuXzQj7cPq3WTzjofdNKSQfuczSzdqDNBfyt7uawzQacuDfTOnL1Eo84BvVfZy2KdA7qCEtwZvm6+Ds3ZW62b+WxxeXEGe6Tv6rkz/FXZW62b180X4Hl6xw5dTdTQLefskY+a987wyCuNQ/lhvXy6L/RIQ6JedE2RQveYs0f7spoRureyx2nNCF1ldNAD5+wRjpoLehRlj82aC7riiKBHnLNHNWoW6NGVPR5rFujqo4AuNGePZNTx0EWVPQbreOiJFAwNmLMXPupIaJiyF2ud4M5w3Mb9EhLcGXa6PRmrwFuYGOgQZS/KWq86QAXcGYK/B/4s5GoRvehwZQ//CkRHBygoNMmcPfCocdBUyh7SWkcHKBA04Zw92KgR0LTKHsZaRweo4tDkc/YAoy4LnULZK22towNUQehEc/aKjrog9PLpfj5blPvzR6/oT5p0dIAqC51o1KV/cFr8zvDy4mw+W5Af1v42xR5fXYI7w6mFgPZRA/6ifmHedQtaNK017L3NwDvDTfz/NNwb5s2TuDOa8BUI8ooW+s2Qyhp8Ea5XHaDQ0CSjrv//dRiBdcgb83V0gIqBDhx11OdMhC06xDrw0zx0dICKhAaPOvbDaYIXDbMO/wggHR2g4qEBow6fszFAW2FrBmUjgZ5CLO8zLHS12PsysGUp7wxHv4WJ+mTYvRFB1x0X9IijppqzEX426fLKhh/WJK80tuNadMUxQg98WU04Z+OEtgHWnMpGC11fvNA9Rk07Z2OGto7WzMpGDl1T7NAtR00+Z+OHthbW/MqWArqOckAfGXWKOVsWaDtgnUXZEkFnLxP0zqgTzdlyQduWdS5l47kz7BHDw6S8M2yZ38JQ3Z60KR+0maVTtqTQGaO7M6w1LRqUoEEJGpSgQQkalKBBCRqUoEEJGpSgQQkalKBBCRqUoEEJGpSgQQkalKBBdbjKumueyz1H9WnRoAQNStCgTj7f36KfYRJp0aAEDUrQoAQNStCgBA1K0KAEDeo/zjmZ6PSCiiAAAAAASUVORK5CYII=";
const COLLECTION_PNG = "iVBORw0KGgoAAAANSUhEUgAAAPAAAACMCAIAAADN17N/AAAE2UlEQVR4nO3dO27bQBRG4XGQrXgv2UVKQ2WaLCJNSiNlduElZA+Bey8jxQ0mE0qi+ZjHvf+cUxkwSY3kD4MRSckPb6+/EpFKH0YPgKhmgCapAE1SAZqkAjRJBWiSCtAkFaBJKkCTVIAmqQBNUn3cstGXy9fW4yDa0vfnb+sbMEOTVIAmqQBNUm1aQ5e9u4ghqtuut3DM0CQVoEkqQJNUgCapAE1SAZqkAjRJBWiSCtA9+nL5yg1efdp9pZB2ZY4vnx7zz1xqbRqgW1VStmDdIUDX75pyGaybBuiarVMug3WjAF2n7ZTLYF09QJ/tGOUyWFcM0Mc7T7kM1lUC9JHqUi6D9ckAva92lMtgfThAb60P5TJYHwjQ79efchmsdwXotcZSLoP1xgB9Oz+Uy2D9boBe5pNyGaxXAvS//FMug/XNAJ1SNMplsF40O+i4lMtgnZsXtAblMlinOUHrUS6bnPVcoLUpl03LehbQ81Aum5C1Pug5KZdNxVoZNJTLJmGtCRrK95JnrQbaFeXnl9/3fjV2hMKsdUD7obzi+HqbgQOWZK0AOhblm7vAulaxQTun/OPnj3vbP31+ut4d1ueLCtoP5XSlecXx9Tal7OeX36ytTxYPtCvK6X/NWygvsl0y6+GmU3DWkUB7o5xOay73dWU6hWUdA7RDyqme5nwEb6ZTQNbeQfuknGprzsdxaDqFYu0XtFvKqY3mfDSfplMQ1h5Be6a8qK7mfMzFST1XOWftC3QIynl6bqE5H9lMe5ukc25ZewEdgjItcsh6POhYlDtMz/n4zifpnCvWI0HHokzrOWE9BjSUVRvOujfo0JS7rTfyo0RZdSwayLof6NCU6UBDWPcADeWZ68y6LWgok9WNdUPQaKZFHVg3BG0jhjWV2RvrdpN08zU0rMlqTdnqdJYD1jPXh7LV9Tw0rGerJ2VrwJXCuKwvnx7tL/T0+anDtZV8E2msV8nqT9kadi9HXNa03ijK1uC77WCt1FjK1vjbR1Mo1t1WHbHWGx4oWy5AW4FYU84PZcsRaMs/6w6TdIjp2Rtlyx1oyz9rq4Vpz5+QtXxStpyCttyyzpN0qm261OzqKVueKVuuQVs+Wbcw7Vmzf8pWANCWQ9Z1TbvVHIWyFQa05Y11LdM+NceibAUDbblivTCddn7icPEWcPjTsSJStkKCtvywLk2nwuj2b/DPx6k+tr3FpWwFBm05YW0Pvfgq/+0n4KBcq/CgLc+st+wyNg3KlghoyxXr5Pj/FOaUKFtSoC0nrIc/+np6lC1B0JYf1t5SpWzJgrZgXaZN2RIHbcF6BsrWFKCtOVnPQ9maCLQ1D+vZKFvTgba0Wc9J2ZoUtKXHembK1tSgLQ3WULYA/be4rKFcBuj/isUaytcB+kb+WUP5XoC+m0/WUF4P0O/khzWUtwToTY1lDeXtAXpH/VlDeW+A3l0f1lA+FqAP1o41lM8E6FPVZQ3l8wG6QudZQ7lWgK7WMdZQrhugK7edNZRbBOgmrbOGcrsA3bBr1lBuHaCbV7KGcusA3Sko9+nD6AEQ1QzQJBWgSSpAk1SAJqkATVIBmqQCNEm1+8KKXfEi8hkzNEkFaJIK0CTVw9vrr9FjIKoWMzRJBWiSCtAkFaBJKkCTVIAmqQBNUgGapAI0SQVokuoPgHxEIw4zdS0AAAAASUVORK5CYII=";

function assertIsolatedCiEnvironment(): void {
  if (
    process.env.NODE_ENV !== "test" ||
    process.env.CI !== "true" ||
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.STOREFRONT_REVIEW_FIXTURES !== "true" ||
    process.env.MYSQL_CATALOGUE_ENABLED !== "true"
  ) {
    throw new Error("Storefront review fixtures may run only in the explicitly enabled GitHub Actions test job.");
  }
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("The disposable storefront fixture database is not configured.");
  const url = new URL(rawUrl);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (
    url.protocol !== "mysql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "3306" ||
    decodeURIComponent(url.username) !== "dag_test" ||
    decodeURIComponent(url.password) !== "dag_test_password" ||
    databaseName !== "desert_gallery_test"
  ) {
    throw new Error("Refusing to seed: the storefront fixture accepts only the disposable loopback desert_gallery_test database.");
  }
  if ((process.env.MEDIA_STORAGE_DRIVER ?? "local").trim().toLowerCase() !== "local") {
    throw new Error("Refusing to seed: CI storefront fixtures require isolated local filesystem media.");
  }
  if (process.env.MEDIA_STORAGE_ROOT !== "/tmp/desert-gallery-ci-media") {
    throw new Error("Refusing to seed: MEDIA_STORAGE_ROOT must be the dedicated disposable CI media directory.");
  }
}

async function main(): Promise<void> {
  assertIsolatedCiEnvironment();
  const db = getMySqlDb();
  const now = new Date();

  try {
    const [existingProduct] = await db.select({ id: products.id }).from(products)
      .where(eq(products.slug, PRODUCT_SLUG)).limit(1);
    const [existingCollection] = await db.select({ id: collections.id }).from(collections)
      .where(eq(collections.slug, COLLECTION_SLUG)).limit(1);
    const [existingCategory] = await db.select({ id: productCategories.id }).from(productCategories)
      .where(eq(productCategories.slug, "ci-review-fixtures")).limit(1);
    const [existingVariant] = await db.select({ id: productVariants.id }).from(productVariants)
      .where(eq(productVariants.sku, "CI-REVIEW-ONLY-001")).limit(1);
    if (existingProduct || existingCollection || existingCategory || existingVariant) {
      throw new Error("The CI storefront fixture already exists; refusing to overwrite or mutate existing catalogue rows.");
    }

    const primaryBytes = Buffer.from(PRIMARY_PNG, "base64");
    const secondaryBytes = Buffer.from(SECONDARY_PNG, "base64");
    const collectionBytes = Buffer.from(COLLECTION_PNG, "base64");
    const primaryKey = "products/" + PRODUCT_ID + "/10000000-0000-4000-8000-000000000201.png";
    const secondaryKey = "products/" + PRODUCT_ID + "/10000000-0000-4000-8000-000000000202.png";
    const collectionKey = "editorial/collection/" + COLLECTION_ID + "/ci-review-cover.png";

    await storeProductMedia(primaryKey, primaryBytes);
    await storeProductMedia(secondaryKey, secondaryBytes);
    await storeEditorialMedia(collectionKey, collectionBytes);

    await db.transaction(async (tx) => {
      await tx.insert(productCategories).values({
        id: CATEGORY_ID, name: "CI review fixtures", slug: "ci-review-fixtures",
        description: "Synthetic category for disposable automated storefront verification only.",
        sortOrder: 0, isActive: true,
      });
      await tx.insert(collections).values({
        id: COLLECTION_ID, name: COLLECTION_NAME, slug: COLLECTION_SLUG,
        description: "Synthetic content used only for automated layout and interaction checks. This is not a merchant collection.",
        heroImagePath: collectionKey,
        heroImageAlt: "Synthetic geometric CI artwork for collection layout testing; not product photography",
        heroImageRightsConfirmed: true, heroImageRightsEvidence: RIGHTS_EVIDENCE,
        sortOrder: 0, isPublished: true,
      });
      await tx.insert(products).values({
        id: PRODUCT_ID, legacyId: null, title: PRODUCT_NAME, slug: PRODUCT_SLUG,
        shortDescription: "Synthetic CI record. Not a real product or sale offer.",
        description: "This synthetic record exists only in the disposable GitHub Actions database to verify public storefront rendering. It is not a real item, merchant listing, product specification or inventory offer.",
        productType: "CI fixture only", materials: ["CI fixture data only"],
        tags: ["ci-only", "not-for-sale"],
        sourceMetadata: { purpose: "automated-storefront-review", merchantData: false },
        sizes: ["Fixture only"], measurements: null, conditionNotes: null,
        provenance: null, craftStory: null, currency: "INR", priceMinor: 125000,
        compareAtPriceMinor: null, status: "published", isOneOfAKind: false,
        featured: true, seoTitle: "CI review fixture — not for sale",
        seoDescription: "Synthetic test data used only for automated storefront verification.",
        publishedAt: now,
      });
      await tx.insert(productCategoryLinks).values({ productId: PRODUCT_ID, categoryId: CATEGORY_ID });
      await tx.insert(productVariants).values({
        id: VARIANT_ID, productId: PRODUCT_ID, sku: "CI-REVIEW-ONLY-001",
        label: "CI test option", attributes: { option: "synthetic fixture" },
        priceMinor: 125000, currency: "INR", stockQuantity: 2, isActive: true, sortOrder: 0,
      });
      await tx.insert(productMedia).values([
        {
          id: PRIMARY_MEDIA_ID, productId: PRODUCT_ID, storageKey: primaryKey,
          altText: "Synthetic CI illustration of a geometric textile sample, not product photography",
          rightsConfirmed: true, rightsEvidence: RIGHTS_EVIDENCE, mimeType: "image/png",
          byteSize: primaryBytes.byteLength, width: 120, height: 160, position: 0, isPrimary: true,
        },
        {
          id: SECONDARY_MEDIA_ID, productId: PRODUCT_ID, storageKey: secondaryKey,
          altText: "Synthetic CI illustration of a geometric sample, alternate view, not product photography",
          rightsConfirmed: true, rightsEvidence: RIGHTS_EVIDENCE, mimeType: "image/png",
          byteSize: secondaryBytes.byteLength, width: 120, height: 160, position: 1, isPrimary: false,
        },
      ]);
      await tx.insert(collectionProductLinks).values({
        id: COLLECTION_LINK_ID, collectionId: COLLECTION_ID, productSlug: PRODUCT_SLUG,
        sortOrder: 0, createdAt: now,
      });
    });

    const [publishedProduct, publishedCollections] = await Promise.all([
      getPublishedProductBySlug(PRODUCT_SLUG),
      getPublishedCollections(),
    ]);
    const publishedCollection = publishedCollections.find((collection) => collection.slug === COLLECTION_SLUG);
    if (!publishedProduct) {
      throw new Error("CI fixture verification failed: the published product is not readable through the public catalogue repository.");
    }
    if (publishedProduct.images?.length !== 2) {
      throw new Error("CI fixture verification failed: the product repository did not return both rights-confirmed product images.");
    }
    if (publishedProduct.variants?.length !== 1 || publishedProduct.variants[0]?.id !== VARIANT_ID) {
      throw new Error("CI fixture verification failed: the active product option is not readable through the public catalogue repository.");
    }
    if (!publishedCollection || !publishedCollection.hero_image_rights_confirmed ||
        !publishedCollection.hero_image_rights_evidence.trim() || !publishedCollection.hero_image_alt.trim()) {
      throw new Error("CI fixture verification failed: the published collection and its rights-confirmed cover are not readable through the editorial repository.");
    }

    console.log("Synthetic published storefront fixture seeded and repository-verified (GitHub Actions disposable database only).");
    console.log("Product: /products/" + PRODUCT_SLUG);
    console.log("Collection: /collections/" + COLLECTION_SLUG);
    console.log("Media: two synthetic product illustrations and one synthetic collection illustration.");
    console.log("Test-only variant value: INR 1,250 and quantity 2; no order or payment is created.");
  } finally {
    await closeMySqlPool();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
