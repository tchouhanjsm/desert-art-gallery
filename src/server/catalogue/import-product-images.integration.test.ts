import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { closeMySqlPool, getMySqlDb } from "../db";
import { products, productMedia } from "../db/schema";
import {
  commitLocalProductImages,
  previewLocalProductImageImport,
  PRODUCT_IMAGE_IMPORT_CONFIRMATION,
} from "./import-product-images";
import { readProductMedia, removeProductMedia } from "../media/product-storage";

const enabled = process.env.MYSQL_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite("local MySQL product image import", () => {
  afterAll(async () => { await closeMySqlPool(); });

  it("matches exact draft slugs, copies originals privately, leaves rights pending and is idempotent", async () => {
    const db = getMySqlDb();
    const productId = randomUUID();
    const slug = "image-intake-" + productId;
    const root = await mkdtemp(join(tmpdir(), "dag-image-intake-"));
    const mediaRoot = await mkdtemp(join(tmpdir(), "dag-private-media-"));
    const folder = join(root, slug);
    const previousMediaRoot = process.env.MEDIA_STORAGE_ROOT;
    await mkdir(folder, { recursive: true });
    process.env.MEDIA_STORAGE_ROOT = mediaRoot;

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    await writeFile(join(folder, "01-primary.jpg"), jpeg);
    await writeFile(join(folder, "02-detail.png"), png);

    try {
      await db.insert(products).values({
        id: productId,
        title: "Image intake integration product",
        slug,
        currency: "USD",
        priceMinor: 12500,
        status: "draft",
      });

      const preview = await previewLocalProductImageImport(root);
      expect(preview.canCommit).toBe(true);
      expect(preview.matchedProducts).toBe(1);
      expect(preview.validImages).toBe(2);
      expect(preview.newImages).toBe(2);

      const imported = await commitLocalProductImages(PRODUCT_IMAGE_IMPORT_CONFIRMATION, root);
      expect(imported.imagesCreated).toBe(2);
      expect(imported.imageRightsApproved).toBe(0);

      const rows = await db.select().from(productMedia)
        .where(eq(productMedia.productId, productId))
        .orderBy(asc(productMedia.position));
      expect(rows).toHaveLength(2);
      expect(rows[0].isPrimary).toBe(true);
      expect(rows[1].isPrimary).toBe(false);
      expect(rows.every((row) => row.rightsConfirmed === false && row.rightsEvidence === "")).toBe(true);
      expect(rows.map((row) => row.position)).toEqual([0, 1]);
      expect(rows[0].altText).toContain("primary product view");

      const storedJpeg = await readProductMedia(rows[0].storageKey);
      expect(storedJpeg?.mimeType).toBe("image/jpeg");
      expect(storedJpeg?.bytes).toEqual(jpeg);
      const storedPng = await readProductMedia(rows[1].storageKey);
      expect(storedPng?.mimeType).toBe("image/png");
      expect(storedPng?.bytes).toEqual(png);

      const replayPreview = await previewLocalProductImageImport(root);
      expect(replayPreview.canCommit).toBe(true);
      expect(replayPreview.newImages).toBe(0);
      expect(replayPreview.duplicateImages).toBe(2);
      const replay = await commitLocalProductImages(PRODUCT_IMAGE_IMPORT_CONFIRMATION, root);
      expect(replay.imagesCreated).toBe(0);
      expect(replay.existingImagesSkipped).toBe(2);

      const finalRows = await db.select().from(productMedia).where(eq(productMedia.productId, productId));
      expect(finalRows).toHaveLength(2);
    } finally {
      const rows = await db.select().from(productMedia).where(eq(productMedia.productId, productId));
      for (const row of rows) await removeProductMedia(row.storageKey).catch(() => undefined);
      await db.delete(products).where(eq(products.id, productId));
      if (previousMediaRoot === undefined) delete process.env.MEDIA_STORAGE_ROOT;
      else process.env.MEDIA_STORAGE_ROOT = previousMediaRoot;
      await rm(root, { recursive: true, force: true });
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("blocks a folder without an exact catalogue slug match", async () => {
    const root = await mkdtemp(join(tmpdir(), "dag-unmatched-intake-"));
    const folder = join(root, "there-is-no-exact-match");
    await mkdir(folder, { recursive: true });
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    await writeFile(join(folder, "01-primary.jpg"), jpeg);
    try {
      const preview = await previewLocalProductImageImport(root);
      expect(preview.canCommit).toBe(false);
      expect(preview.errors.join(" ")).toContain("No MySQL product matches this exact slug");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
