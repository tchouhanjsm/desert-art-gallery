import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { asc, eq, inArray } from "drizzle-orm";
import {
  MAX_PRODUCT_IMAGE_BYTES,
  parseProductImageName,
  validateProductImageBytes,
  type ProductImageRole,
} from "../../lib/product-image-intake";
import { getMySqlDb } from "../db";
import { assertLocalMySqlTarget } from "../db/safety";
import { productMedia, products } from "../db/schema";
import {
  createDeterministicProductStorageKey,
  storeProductMedia,
} from "../media/product-storage";
import type { EditorialImageMime } from "../media/storage";

export const PRODUCT_IMAGE_IMPORT_CONFIRMATION = "IMPORT_PRODUCT_IMAGES_TO_LOCAL_MYSQL";
export const DEFAULT_PRODUCT_IMAGE_INTAKE_ROOT = path.resolve(
  process.cwd(),
  ".local-data",
  "imports",
  "product-images",
);

const PRODUCT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIME_TYPES = new Set<EditorialImageMime>([
  "image/jpeg", "image/png", "image/webp", "image/avif",
]);

export type ProductImageImportFile = {
  filename: string;
  sequence: number;
  role: ProductImageRole;
  mimeType: EditorialImageMime;
  byteSize: number;
  sha256: string;
  storageKey: string;
  alreadyImported: boolean;
  duplicateInBatch: boolean;
  filePath: string;
};

export type ProductImageImportFolder = {
  slug: string;
  productId: string | null;
  productTitle: string | null;
  productStatus: string | null;
  files: ProductImageImportFile[];
  errors: string[];
  warnings: string[];
  existingMediaCount: number;
  hasExistingPrimary: boolean;
};

export type ProductImageImportPreview = {
  intakeRoot: string;
  productFolders: number;
  matchedProducts: number;
  validImages: number;
  newImages: number;
  duplicateImages: number;
  folders: ProductImageImportFolder[];
  errors: string[];
  warnings: string[];
  canCommit: boolean;
};

export type ProductImageImportResult = {
  productsMatched: number;
  imagesCreated: number;
  existingImagesSkipped: number;
  primaryFlagsRepaired: number;
  imageRightsApproved: 0;
};

function roleDescription(role: ProductImageRole): string {
  switch (role) {
    case "primary": return "primary product view";
    case "detail": return "detail view";
    case "back": return "back view";
    case "label": return "label detail";
    case "texture": return "texture detail";
    case "packaging": return "packaging view";
  }
}

async function readIntakeRoot(root: string) {
  try {
    const stats = await lstat(root);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error("The product image intake root must be a real directory, not a symbolic link.");
    }
    return await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Product image intake folder not found. Run npm run local:prepare first.");
    }
    throw error;
  }
}

export async function previewLocalProductImageImport(
  intakeRoot = DEFAULT_PRODUCT_IMAGE_INTAKE_ROOT,
): Promise<ProductImageImportPreview> {
  assertLocalMySqlTarget();
  const root = path.resolve(intakeRoot);
  const entries = await readIntakeRoot(root);
  const errors: string[] = [];
  const warnings: string[] = [];
  const folders: ProductImageImportFolder[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name.startsWith("._")) continue;
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      errors.push(entry.name + ": place photographs inside a product-slug directory; symbolic links are not accepted.");
      continue;
    }
    if (!PRODUCT_SLUG_PATTERN.test(entry.name)) {
      errors.push(entry.name + ": folder must exactly match a lowercase product slug.");
      continue;
    }

    const folderPath = path.join(root, entry.name);
    const children = await readdir(folderPath, { withFileTypes: true });
    const folder: ProductImageImportFolder = {
      slug: entry.name,
      productId: null,
      productTitle: null,
      productStatus: null,
      files: [],
      errors: [],
      warnings: [],
      existingMediaCount: 0,
      hasExistingPrimary: false,
    };
    const sequences = new Set<number>();
    let primaryCount = 0;

    for (const child of children) {
      if (child.name.startsWith(".") || child.name.startsWith("._")) continue;
      if (!child.isFile() || child.isSymbolicLink()) {
        folder.errors.push(child.name + ": nested directories, special files and symbolic links are not accepted.");
        continue;
      }

      const parsed = parseProductImageName(child.name);
      if (!parsed) {
        folder.errors.push(child.name + ": use NN-primary/detail/back/label/texture/packaging.jpg/png/webp/avif.");
        continue;
      }
      if (sequences.has(parsed.sequence)) {
        folder.errors.push(child.name + ": image sequence number is duplicated.");
        continue;
      }
      sequences.add(parsed.sequence);
      if (parsed.role === "primary") primaryCount += 1;

      const filePath = path.join(folderPath, child.name);
      const stats = await lstat(filePath);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        folder.errors.push(child.name + ": the image must be a regular file.");
        continue;
      }
      if (stats.size < 1 || stats.size > MAX_PRODUCT_IMAGE_BYTES) {
        folder.errors.push(child.name + ": image must be between 1 byte and 12 MB.");
        continue;
      }

      const bytes = await readFile(filePath);
      const validation = validateProductImageBytes(child.name, bytes);
      if (!validation.valid || !MIME_TYPES.has(validation.mimeType as EditorialImageMime)) {
        folder.errors.push(child.name + ": " + (validation.valid ? "unsupported image MIME type." : validation.reason));
        continue;
      }
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const mimeType = validation.mimeType as EditorialImageMime;
      folder.files.push({
        filename: child.name,
        sequence: parsed.sequence,
        role: parsed.role,
        mimeType,
        byteSize: bytes.byteLength,
        sha256,
        storageKey: "",
        alreadyImported: false,
        duplicateInBatch: false,
        filePath,
      });
    }

    if (primaryCount !== 1) {
      folder.errors.push("Expected exactly one 01-primary image; found " + primaryCount + ".");
    }
    if (!folder.files.length) folder.errors.push("No valid product photographs were found.");
    folder.files.sort((left, right) => left.sequence - right.sequence);
    folders.push(folder);
  }

  if (!folders.length && !errors.length) errors.push("No product-slug folders were found in the intake directory.");
  const slugs = [...new Set(folders.map((folder) => folder.slug))];
  if (slugs.length !== folders.length) errors.push("Duplicate product-slug folders were detected.");

  const db = getMySqlDb();
  const matched = slugs.length
    ? await db.select({
      id: products.id,
      slug: products.slug,
      title: products.title,
      status: products.status,
    }).from(products).where(inArray(products.slug, slugs))
    : [];
  const productBySlug = new Map(matched.map((product) => [product.slug, product]));
  const productIds: string[] = [];

  for (const folder of folders) {
    const product = productBySlug.get(folder.slug);
    if (!product) {
      folder.errors.push("No MySQL product matches this exact slug. Import or create the product first; title matching is not attempted.");
      continue;
    }
    folder.productId = product.id;
    folder.productTitle = product.title;
    folder.productStatus = product.status;
    productIds.push(product.id);
    if (product.status !== "draft") {
      folder.errors.push("Product status is " + product.status + "; bulk photo intake only attaches to draft products.");
    }
  }

  const existingRows = productIds.length
    ? await db.select({
      productId: productMedia.productId,
      storageKey: productMedia.storageKey,
      position: productMedia.position,
      isPrimary: productMedia.isPrimary,
    }).from(productMedia).where(inArray(productMedia.productId, productIds))
    : [];
  const existingByProduct = new Map<string, typeof existingRows>();
  for (const row of existingRows) {
    existingByProduct.set(row.productId, [...(existingByProduct.get(row.productId) ?? []), row]);
  }

  const seenKeys = new Set<string>();
  for (const folder of folders) {
    if (!folder.productId) continue;
    const productMediaRows = existingByProduct.get(folder.productId) ?? [];
    folder.existingMediaCount = productMediaRows.length;
    folder.hasExistingPrimary = productMediaRows.some((row) => row.isPrimary);
    const existingKeys = new Set(productMediaRows.map((row) => row.storageKey));
    for (const file of folder.files) {
      file.storageKey = createDeterministicProductStorageKey(folder.productId, file.sha256, file.mimeType);
      file.alreadyImported = existingKeys.has(file.storageKey);
      file.duplicateInBatch = seenKeys.has(file.storageKey);
      seenKeys.add(file.storageKey);
      if (file.alreadyImported || file.duplicateInBatch) {
        folder.warnings.push(file.filename + ": identical image content is already attached or appears more than once; it will not create a duplicate media record.");
      }
    }
    if (folder.hasExistingPrimary) {
      folder.warnings.push("An existing primary image is preserved; the incoming 01-primary file will not replace it.");
    }
  }

  for (const folder of folders) {
    errors.push(...folder.errors.map((message) => folder.slug + ": " + message));
    warnings.push(...folder.warnings.map((message) => folder.slug + ": " + message));
  }

  const validImages = folders.reduce((total, folder) => total + folder.files.length, 0);
  const duplicateImages = folders.reduce(
    (total, folder) => total + folder.files.filter((file) => file.alreadyImported || file.duplicateInBatch).length,
    0,
  );
  const newImages = validImages - duplicateImages;
  return {
    intakeRoot: root,
    productFolders: folders.length,
    matchedProducts: folders.filter((folder) => folder.productId !== null && folder.productStatus === "draft").length,
    validImages,
    newImages,
    duplicateImages,
    folders,
    errors,
    warnings,
    canCommit: errors.length === 0 && validImages > 0 && folders.length > 0
      && folders.every((folder) => folder.productId !== null && folder.productStatus === "draft"),
  };
}

export async function commitLocalProductImages(
  confirmation: string,
  intakeRoot = DEFAULT_PRODUCT_IMAGE_INTAKE_ROOT,
): Promise<ProductImageImportResult> {
  if (confirmation !== PRODUCT_IMAGE_IMPORT_CONFIRMATION) {
    throw new Error("Pass the explicit IMPORT_PRODUCT_IMAGES_TO_LOCAL_MYSQL confirmation before importing photographs.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Product image import is blocked when NODE_ENV=production.");
  }
  assertLocalMySqlTarget();
  const preview = await previewLocalProductImageImport(intakeRoot);
  if (!preview.canCommit) {
    throw new Error("Product image import is not ready. " + preview.errors.join(" "));
  }

  // Copy validated bytes to private storage first. A failed DB transaction can leave
  // only unreferenced deterministic files; rerunning safely reuses the same keys.
  for (const folder of preview.folders) {
    for (const file of folder.files) {
      const bytes = await readFile(file.filePath);
      const actualHash = createHash("sha256").update(bytes).digest("hex");
      if (actualHash !== file.sha256) {
        throw new Error(folder.slug + "/" + file.filename + " changed after preview. Run the preview again.");
      }
      const validation = validateProductImageBytes(file.filename, bytes);
      if (!validation.valid || validation.mimeType !== file.mimeType || bytes.byteLength !== file.byteSize) {
        throw new Error(folder.slug + "/" + file.filename + " failed revalidation. Run the preview again.");
      }
      await storeProductMedia(file.storageKey, bytes);
    }
  }

  const db = getMySqlDb();
  let imagesCreated = 0;
  let existingImagesSkipped = 0;
  let primaryFlagsRepaired = 0;

  await db.transaction(async (tx) => {
    for (const folder of preview.folders) {
      if (!folder.productId) throw new Error("A product match changed after preview.");
      const [product] = await tx.select({
        id: products.id,
        slug: products.slug,
        title: products.title,
        status: products.status,
      }).from(products).where(eq(products.id, folder.productId)).limit(1);
      if (!product || product.slug !== folder.slug || product.status !== "draft") {
        throw new Error("Product " + folder.slug + " changed after preview. No image metadata was imported.");
      }

      const currentMedia = await tx.select({
        id: productMedia.id,
        storageKey: productMedia.storageKey,
        position: productMedia.position,
        isPrimary: productMedia.isPrimary,
      }).from(productMedia).where(eq(productMedia.productId, product.id)).orderBy(asc(productMedia.position));
      const existingByKey = new Map(currentMedia.map((row) => [row.storageKey, row]));
      let nextPosition = currentMedia.reduce((maximum, row) => Math.max(maximum, row.position), -1) + 1;
      let hasPrimary = currentMedia.some((row) => row.isPrimary);

      for (const file of folder.files) {
        const existing = existingByKey.get(file.storageKey);
        if (existing) {
          if (file.role === "primary" && !hasPrimary) {
            await tx.update(productMedia).set({ isPrimary: true }).where(eq(productMedia.id, existing.id));
            hasPrimary = true;
            primaryFlagsRepaired += 1;
          }
          existingImagesSkipped += 1;
          continue;
        }
        if (file.duplicateInBatch) {
          existingImagesSkipped += 1;
          continue;
        }

        const makePrimary = file.role === "primary" && !hasPrimary;
        await tx.insert(productMedia).values({
          id: randomUUID(),
          productId: product.id,
          storageKey: file.storageKey,
          altText: ("Product photograph of " + product.title + " — " + roleDescription(file.role) + ". Review this description before publication.").slice(0, 300),
          rightsConfirmed: false,
          rightsEvidence: "",
          mimeType: file.mimeType,
          byteSize: file.byteSize,
          width: null,
          height: null,
          position: nextPosition,
          isPrimary: makePrimary,
        });
        nextPosition += 1;
        imagesCreated += 1;
        if (makePrimary) hasPrimary = true;
      }
    }
  });

  return {
    productsMatched: preview.matchedProducts,
    imagesCreated,
    existingImagesSkipped,
    primaryFlagsRepaired,
    imageRightsApproved: 0,
  };
}
