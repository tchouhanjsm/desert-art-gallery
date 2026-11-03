import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { isAllowedEtsyImageUrl } from "../../lib/etsy-listings-import";
import {
  MAX_PRODUCT_IMAGE_BYTES,
  detectProductImageMime,
  type ProductImageRole,
} from "../../lib/product-image-intake";
import { getMySqlDb } from "../db";
import { assertLocalMySqlTarget } from "../db/safety";
import { products } from "../db/schema";
import type { EditorialImageMime } from "../media/storage";

export const DEFAULT_ETSY_IMAGE_INTAKE_ROOT = path.resolve(
  process.cwd(),
  ".local-data",
  "imports",
  "product-images",
);
export const ETSY_DOWNLOAD_CONFIRMATION = "DOWNLOAD_ETSY_IMAGES_TO_LOCAL";
const MAX_IMAGES_PER_PRODUCT = 10;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;
const ALLOWED_MIME_TYPES = new Set<EditorialImageMime>([
  "image/jpeg", "image/png", "image/webp", "image/avif",
]);
const ROLE_BY_SEQUENCE: ProductImageRole[] = [
  "primary", "detail", "detail", "detail", "detail",
  "detail", "detail", "detail", "detail", "detail",
];

type DownloadManifestEntry = {
  sourceUrlSha256: string;
  fileName: string;
  status: "pending" | "complete";
  sha256?: string;
  mimeType?: EditorialImageMime;
  byteSize?: number;
};

type DownloadManifest = {
  version: 1;
  entries: Record<string, DownloadManifestEntry>;
};

export type EtsyImageDownloadPreview = {
  intakeRoot: string;
  productsFound: number;
  productsReady: number;
  imagesFound: number;
  imagesAlreadyDownloaded: number;
  products: Array<{
    slug: string;
    title: string;
    status: string;
    imageCount: number;
    imageUrlsSha256: string;
    alreadyDownloaded: number;
    errors: string[];
    warnings: string[];
  }>;
  errors: string[];
  warnings: string[];
  canDownload: boolean;
};

export type EtsyImageDownloadResult = {
  productsProcessed: number;
  imagesDownloaded: number;
  imagesSkipped: number;
  bytesDownloaded: number;
  intakeRoot: string;
};

export type EtsyImageFetcher = typeof fetch;

type EtsyProduct = {
  id: string;
  title: string;
  slug: string;
  status: string;
  imageUrls: string[];
};

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function mimeExtension(mimeType: EditorialImageMime): string {
  switch (mimeType) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/avif": return "avif";
  }
}

function imageFileName(sequence: number, mimeType: EditorialImageMime): string {
  const prefix = String(sequence).padStart(2, "0");
  return prefix + "-" + ROLE_BY_SEQUENCE[sequence - 1] + "." + mimeExtension(mimeType);
}

function digest(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeProductSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

async function ensureDirectory(directory: string): Promise<void> {
  try {
    const stats = await lstat(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error("Refusing to use a product image path that is not a real directory: " + directory);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const stats = await lstat(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error("Product image directory could not be created safely: " + directory);
    }
  }
}

async function readManifest(manifestPath: string): Promise<DownloadManifest> {
  try {
    const stats = await lstat(manifestPath);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size > 16 * 1024) {
      throw new Error("Etsy image download manifest must be a small regular file.");
    }
    const parsed: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
    const record = safeRecord(parsed);
    const rawEntries = safeRecord(record.entries);
    if (record.version !== 1 || !record.entries || typeof record.entries !== "object" || Array.isArray(record.entries)) {
      throw new Error("Etsy image download manifest has an unsupported format.");
    }
    const entries: Record<string, DownloadManifestEntry> = {};
    for (const [sequence, rawEntry] of Object.entries(rawEntries)) {
      const entry = safeRecord(rawEntry);
      const sequenceNumber = Number(sequence);
      const prefix = String(sequenceNumber).padStart(2, "0") + (sequenceNumber === 1 ? "-primary." : "-detail.");
      const validFileName = entry.fileName === "" || (
        typeof entry.fileName === "string"
        && entry.fileName.startsWith(prefix)
        && ["jpg", "png", "webp", "avif"].some((extension) => entry.fileName === prefix + extension)
      );
      if (!/^(?:[1-9]|10)$/.test(sequence)
        || typeof entry.sourceUrlSha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sourceUrlSha256)
        || typeof entry.fileName !== "string" || !validFileName
        || (entry.status !== "pending" && entry.status !== "complete")) {
        throw new Error("Etsy image download manifest contains an invalid image entry.");
      }
      if (entry.status === "complete"
        && (entry.fileName === ""
          || typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)
          || typeof entry.mimeType !== "string" || !ALLOWED_MIME_TYPES.has(entry.mimeType as EditorialImageMime)
          || typeof entry.byteSize !== "number" || entry.byteSize < 1 || entry.byteSize > MAX_PRODUCT_IMAGE_BYTES)) {
        throw new Error("Etsy image download manifest contains invalid completed-image metadata.");
      }
      if (entry.status === "complete") {
        const extension = mimeExtension(entry.mimeType as EditorialImageMime);
        if (entry.fileName !== prefix + extension) {
          throw new Error("Etsy image download manifest filename and MIME type do not agree.");
        }
      }
      entries[sequence] = entry as DownloadManifestEntry;
    }
    return { version: 1, entries };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, entries: {} };
    }
    throw error;
  }
}

async function writeManifest(manifestPath: string, manifest: DownloadManifest): Promise<void> {
  const temporary = manifestPath + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporary, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    await rename(temporary, manifestPath);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function fetchEtsyImageBytes(
  sourceUrl: string,
  fetcher: EtsyImageFetcher = fetch,
): Promise<{ bytes: Uint8Array; mimeType: EditorialImageMime }> {
  if (!isAllowedEtsyImageUrl(sourceUrl)) {
    throw new Error("Image URL is not an approved Etsy static-image URL.");
  }
  let currentUrl = sourceUrl;
  let response: Response | null = null;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    response = await fetcher(currentUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    await response.body?.cancel().catch(() => undefined);
    if (!location) throw new Error("Etsy image redirect did not include a Location header.");
    if (redirects === MAX_REDIRECTS) throw new Error("Etsy image exceeded the redirect limit.");
    const redirectedUrl = new URL(location, currentUrl).toString();
    if (!isAllowedEtsyImageUrl(redirectedUrl)) {
      throw new Error("Etsy image redirect left the approved i.etsystatic.com host.");
    }
    currentUrl = redirectedUrl;
  }

  if (!response || !response.ok) {
    throw new Error("Etsy image request failed with HTTP " + (response?.status ?? "unknown") + ".");
  }
  const rawLength = response.headers.get("content-length");
  if (rawLength && !/^\d+$/.test(rawLength)) {
    throw new Error("Etsy image response has an invalid Content-Length header.");
  }
  if (rawLength && Number(rawLength) > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error("Etsy image exceeds the 12 MB download limit.");
  }
  const declaredMime = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (declaredMime && !ALLOWED_MIME_TYPES.has(declaredMime as EditorialImageMime)) {
    throw new Error("Etsy CDN returned an unsupported Content-Type: " + declaredMime + ".");
  }
  if (!response.body) throw new Error("Etsy image response did not contain a body.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      totalBytes += part.value.byteLength;
      if (totalBytes > MAX_PRODUCT_IMAGE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("Etsy image exceeds the 12 MB download limit.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (totalBytes < 1) throw new Error("Etsy CDN returned an empty image.");
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const detectedMime = detectProductImageMime(bytes);
  if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime as EditorialImageMime)) {
    throw new Error("Downloaded bytes are not a supported JPEG, PNG, WebP or AVIF image.");
  }
  if (declaredMime && detectedMime !== declaredMime) {
    throw new Error("Downloaded image signature does not match the CDN Content-Type.");
  }
  return { bytes, mimeType: detectedMime as EditorialImageMime };
}

async function stageProductImages(
  root: string,
  product: EtsyProduct,
  fetcher: EtsyImageFetcher,
): Promise<{ downloaded: number; skipped: number; bytes: number }> {
  if (!safeProductSlug(product.slug)) throw new Error("Product slug is not safe for a local image folder.");
  if (product.status !== "draft") throw new Error("Product is not a draft; automatic Etsy image download is blocked.");
  const folder = path.resolve(root, product.slug);
  if (!folder.startsWith(root + path.sep)) throw new Error("Product image folder escaped the intake root.");
  await ensureDirectory(folder);

  const manifestPath = path.join(folder, ".etsy-download-manifest.json");
  const manifest = await readManifest(manifestPath);
  let downloaded = 0;
  let skipped = 0;
  let bytesDownloaded = 0;

  for (let index = 0; index < product.imageUrls.length; index += 1) {
    const sourceUrl = product.imageUrls[index];
    if (!isAllowedEtsyImageUrl(sourceUrl)) {
      throw new Error(product.slug + ": IMAGE" + (index + 1) + " is not an approved Etsy CDN URL.");
    }
    const sequence = index + 1;
    const sequenceKey = String(sequence);
    const sourceUrlSha256 = digest(sourceUrl);
    const previous = manifest.entries[sequenceKey];

    if (previous && previous.sourceUrlSha256 !== sourceUrlSha256) {
      throw new Error(product.slug + ": IMAGE" + sequence + " source URL changed since the previous download. Review the existing file before replacing it.");
    }

    if (previous?.status === "complete") {
      const existingPath = path.join(folder, previous.fileName);
      try {
        const existingStats = await lstat(existingPath);
        if (!existingStats.isFile() || existingStats.isSymbolicLink()) {
          throw new Error(product.slug + ": an existing downloaded image is not a regular file.");
        }
        const existingBytes = await readFile(existingPath);
        if (digest(existingBytes) !== previous.sha256) {
          throw new Error(product.slug + ": downloaded image changed after the manifest was written; refusing to overwrite it.");
        }
        skipped += 1;
        continue;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    } else if (!previous) {
      const prefix = String(sequence).padStart(2, "0") + "-";
      const files = await readdir(folder);
      if (files.some((file) => file.startsWith(prefix) && !file.startsWith("."))) {
        throw new Error(product.slug + ": a local image already occupies IMAGE" + sequence + "; refusing to overwrite manually supplied photography.");
      }
    }

    const pending: DownloadManifestEntry = previous ?? {
      sourceUrlSha256,
      fileName: "",
      status: "pending",
    };
    manifest.entries[sequenceKey] = { ...pending, sourceUrlSha256, status: "pending" };
    await writeManifest(manifestPath, manifest);

    const asset = await fetchEtsyImageBytes(sourceUrl, fetcher);
    const fileName = imageFileName(sequence, asset.mimeType);
    const destination = path.join(folder, fileName);
    if (pending.fileName && pending.fileName !== fileName) {
      throw new Error(product.slug + ": IMAGE" + sequence + " changed image format between download attempts.");
    }
    manifest.entries[sequenceKey] = { ...manifest.entries[sequenceKey], fileName };
    await writeManifest(manifestPath, manifest);

    const temporary = destination + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temporary, asset.bytes, { flag: "wx", mode: 0o600 });
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }

    manifest.entries[sequenceKey] = {
      sourceUrlSha256,
      fileName,
      status: "complete",
      sha256: digest(asset.bytes),
      mimeType: asset.mimeType,
      byteSize: asset.bytes.byteLength,
    };
    await writeManifest(manifestPath, manifest);
    downloaded += 1;
    bytesDownloaded += asset.bytes.byteLength;
  }

  return { downloaded, skipped, bytes: bytesDownloaded };
}

export async function previewEtsyImageDownloads(
  intakeRoot = DEFAULT_ETSY_IMAGE_INTAKE_ROOT,
): Promise<EtsyImageDownloadPreview> {
  assertLocalMySqlTarget();
  const root = path.resolve(intakeRoot);
  try {
    const rootStats = await lstat(root);
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
      throw new Error("Product image intake root must be a real directory, not a symbolic link.");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const db = getMySqlDb();
  const rows = await db.select({
    id: products.id,
    title: products.title,
    slug: products.slug,
    status: products.status,
    sourceMetadata: products.sourceMetadata,
  }).from(products).orderBy(asc(products.title));
  const etsyRows = rows.flatMap((row) => {
    const metadata = safeRecord(row.sourceMetadata);
    if (metadata.provider !== "etsy") return [];
    const rawUrls = metadata.imageUrls;
    const imageUrls = Array.isArray(rawUrls) ? rawUrls.filter((item): item is string => typeof item === "string") : [];
    return [{ id: row.id, title: row.title, slug: row.slug, status: row.status, imageUrls }];
  });

  const errors: string[] = [];
  const warnings: string[] = [];
  const productsPreview: EtsyImageDownloadPreview["products"] = [];
  let imagesFound = 0;
  let imagesAlreadyDownloaded = 0;
  let productsReady = 0;

  for (const product of etsyRows) {
    const productErrors: string[] = [];
    const productWarnings: string[] = [];
    if (!safeProductSlug(product.slug)) productErrors.push("Product slug is invalid for a local folder.");
    if (product.status !== "draft") productErrors.push("Product is " + product.status + "; only draft products can receive automatic images.");
    if (!product.imageUrls.length) productWarnings.push("No approved Etsy image URLs are recorded.");
    if (product.imageUrls.length > MAX_IMAGES_PER_PRODUCT) productErrors.push("More than 10 Etsy image URLs are recorded.");
    product.imageUrls.forEach((url, index) => {
      if (!isAllowedEtsyImageUrl(url)) productErrors.push("IMAGE" + (index + 1) + " is not an approved i.etsystatic.com URL.");
    });

    let alreadyDownloaded = 0;
    if (!productErrors.length && product.imageUrls.length) {
      const folder = path.join(root, product.slug);
      let localFiles: string[] = [];
      try {
        const folderStats = await lstat(folder);
        if (!folderStats.isDirectory() || folderStats.isSymbolicLink()) {
          productErrors.push("Existing product image path is not a real directory.");
        } else {
          localFiles = await readdir(folder);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          productErrors.push(error instanceof Error ? error.message : "Unable to inspect the product image folder.");
        }
      }

      const manifestPath = path.join(folder, ".etsy-download-manifest.json");
      const manifest = await readManifest(manifestPath).catch((error: unknown) => {
        productErrors.push(error instanceof Error ? error.message : "Unable to read Etsy download manifest.");
        return { version: 1 as const, entries: {} };
      });
      for (let index = 0; index < product.imageUrls.length; index += 1) {
        const sequence = index + 1;
        const key = String(sequence);
        const entry = manifest.entries[key];
        const prefix = String(sequence).padStart(2, "0") + "-";
        if (entry && entry.sourceUrlSha256 !== digest(product.imageUrls[index])) {
          productErrors.push("IMAGE" + sequence + " source URL changed since the prior download; inspect the existing photograph before replacing it.");
          continue;
        }
        const untrackedFiles = localFiles.filter((file) => file.startsWith(prefix) && !file.startsWith(".")
          && (!entry || (entry.status === "complete" && file !== entry.fileName)
            || (entry.status === "pending" && Boolean(entry.fileName) && file !== entry.fileName)));
        if (!entry && untrackedFiles.length) {
          productErrors.push("IMAGE" + sequence + " already has a local photograph without an Etsy download manifest; refusing to overwrite it.");
        } else if (untrackedFiles.length) {
          productErrors.push("IMAGE" + sequence + " has an extra untracked photograph that would collide with the downloaded sequence.");
        }

        if (entry?.status === "complete") {
          try {
            const filePath = path.join(folder, entry.fileName);
            const fileStats = await lstat(filePath);
            if (!fileStats.isFile() || fileStats.isSymbolicLink()
              || fileStats.size !== entry.byteSize || fileStats.size > MAX_PRODUCT_IMAGE_BYTES) {
              productErrors.push("IMAGE" + sequence + " previously downloaded file failed its manifest size or file-type check.");
              continue;
            }
            const bytes = await readFile(filePath);
            if (digest(bytes) !== entry.sha256 || detectProductImageMime(bytes) !== entry.mimeType) {
              productErrors.push("IMAGE" + sequence + " previously downloaded file failed its checksum or signature check.");
              continue;
            }
            alreadyDownloaded += 1;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
              productWarnings.push("IMAGE" + sequence + " is missing locally and will be downloaded again.");
            } else {
              productErrors.push(error instanceof Error ? error.message : "Unable to verify a previously downloaded image.");
            }
          }
        }
      }
    }

    if (!productErrors.length && product.imageUrls.length) productsReady += 1;
    imagesFound += product.imageUrls.length;
    imagesAlreadyDownloaded += alreadyDownloaded;
    errors.push(...productErrors.map((message) => product.slug + ": " + message));
    warnings.push(...productWarnings.map((message) => product.slug + ": " + message));
    productsPreview.push({
      slug: product.slug,
      title: product.title,
      status: product.status,
      imageCount: product.imageUrls.length,
      imageUrlsSha256: digest(JSON.stringify(product.imageUrls)),
      alreadyDownloaded,
      errors: productErrors,
      warnings: productWarnings,
    });
  }

  return {
    intakeRoot: root,
    productsFound: etsyRows.length,
    productsReady,
    imagesFound,
    imagesAlreadyDownloaded,
    products: productsPreview,
    errors,
    warnings,
    canDownload: errors.length === 0 && imagesFound > 0 && productsReady > 0,
  };
}

export async function downloadEtsyProductImages(
  confirmation: string,
  intakeRoot = DEFAULT_ETSY_IMAGE_INTAKE_ROOT,
  fetcher: EtsyImageFetcher = fetch,
): Promise<EtsyImageDownloadResult> {
  if (confirmation !== ETSY_DOWNLOAD_CONFIRMATION) {
    throw new Error("Pass the explicit DOWNLOAD_ETSY_IMAGES_TO_LOCAL confirmation before making network requests or writing files.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Etsy image downloads are blocked when NODE_ENV=production.");
  }
  assertLocalMySqlTarget();
  const preview = await previewEtsyImageDownloads(intakeRoot);
  if (!preview.canDownload) {
    throw new Error("Etsy image download is not ready. " + preview.errors.join(" "));
  }

  const root = path.resolve(intakeRoot);
  await ensureDirectory(root);
  let imagesDownloaded = 0;
  let imagesSkipped = 0;
  let bytesDownloaded = 0;
  let productsProcessed = 0;
  const db = getMySqlDb();

  for (const productPreview of preview.products) {
    if (!productPreview.imageCount) continue;
    const [productRow] = await db.select({
      id: products.id,
      title: products.title,
      slug: products.slug,
      status: products.status,
      sourceMetadata: products.sourceMetadata,
    }).from(products).where(eq(products.slug, productPreview.slug)).limit(1);
    if (!productRow || productRow.status !== "draft") {
      throw new Error(productPreview.slug + ": draft product disappeared or changed state before download.");
    }
    const metadata = safeRecord(productRow.sourceMetadata);
    if (metadata.provider !== "etsy" || !Array.isArray(metadata.imageUrls)) {
      throw new Error(productPreview.slug + ": Etsy source image metadata changed after preview.");
    }
    const imageUrls = metadata.imageUrls.filter((item): item is string => typeof item === "string");
    if (digest(JSON.stringify(imageUrls)) !== productPreview.imageUrlsSha256) {
      throw new Error(productPreview.slug + ": Etsy image list changed after preview. Run the preview again.");
    }
    const result = await stageProductImages(
      root,
      { id: productRow.id, title: productRow.title, slug: productRow.slug, status: productRow.status, imageUrls },
      fetcher,
    );
    productsProcessed += 1;
    imagesDownloaded += result.downloaded;
    imagesSkipped += result.skipped;
    bytesDownloaded += result.bytes;
  }

  return {
    productsProcessed,
    imagesDownloaded,
    imagesSkipped,
    bytesDownloaded,
    intakeRoot: root,
  };
}
