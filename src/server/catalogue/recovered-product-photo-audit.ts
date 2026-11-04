import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { createReadStream } from "node:fs";
import { lstat, open, readdir } from "node:fs/promises";
import path from "node:path";

export const MAX_RECOVERED_IMAGE_BYTES = 12 * 1024 * 1024;
const HEADER_BYTES = 64 * 1024;
const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

export const DEFAULT_RECOVERED_PHOTO_ROOT = path.resolve(
  process.cwd(),
  "public",
  "images",
  "products",
);

export type RecoveredPhotoDimensions = { width: number; height: number } | null;
export type RecoveredPhotoIssue =
  | "empty_file"
  | "invalid_signature"
  | "extension_mime_mismatch"
  | "oversized"
  | "read_error";

export type RecoveredPhotoFile = {
  folderName: string;
  fileName: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  detectedMimeType: string | null;
  sha256: string | null;
  dimensions: RecoveredPhotoDimensions;
  issues: RecoveredPhotoIssue[];
};

export type RecoveredPhotoFolder = {
  folderName: string;
  imageCount: number;
  imageBytes: number;
  empty: boolean;
  noSupportedPhotos: boolean;
  oversizedImages: string[];
  unsupportedFiles: string[];
  nestedDirectories: string[];
  ignoredSidecars: string[];
  errors: string[];
};

export type RecoveredPhotoDuplicateGroup = {
  sha256: string;
  sizeBytes: number;
  files: string[];
};

export type RecoveredPhotoAudit = {
  root: string;
  generatedAt: string;
  limits: { maxImageBytes: number; supportedExtensions: string[] };
  summary: {
    productFolders: number;
    imageFiles: number;
    totalImageBytes: number;
    emptyProductFolders: number;
    foldersWithoutSupportedPhotos: number;
    oversizedImages: number;
    unsupportedFiles: number;
    invalidSignatures: number;
    extensionMimeMismatches: number;
    unreadableFiles: number;
    nestedDirectories: number;
    symbolicLinks: number;
    macosSidecars: number;
    duplicateGroups: number;
    duplicateFiles: number;
    duplicateExtraCopies: number;
  };
  fileTypeCounts: Record<string, number>;
  detectedMimeCounts: Record<string, number>;
  folders: RecoveredPhotoFolder[];
  files: RecoveredPhotoFile[];
  duplicateGroups: RecoveredPhotoDuplicateGroup[];
  errors: string[];
};

function detectImageMimeType(header: Buffer): string | null {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    header.length >= 8
    && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (
    header.length >= 12
    && header.toString("ascii", 0, 4) === "RIFF"
    && header.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (header.length >= 16 && header.toString("ascii", 4, 8) === "ftyp") {
    const brands = header.toString("ascii", 8);
    if (/(^|avif|avis)/.test(brands.slice(0, Math.min(brands.length, HEADER_BYTES)))) {
      if (brands.startsWith("avif") || brands.startsWith("avis") || brands.includes("avif") || brands.includes("avis")) {
        return "image/avif";
      }
    }
  }
  return null;
}

function jpegDimensions(header: Buffer): RecoveredPhotoDimensions {
  if (header.length < 4 || header[0] !== 0xff || header[1] !== 0xd8) return null;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 4 < header.length) {
    if (header[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < header.length && header[offset] === 0xff) offset += 1;
    if (offset >= header.length) break;
    const marker = header[offset++];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > header.length) break;
    const segmentLength = header.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > header.length) break;
    if (startOfFrame.has(marker) && segmentLength >= 7) {
      const height = header.readUInt16BE(offset + 3);
      const width = header.readUInt16BE(offset + 5);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += segmentLength;
  }
  return null;
}

function readDimensions(header: Buffer, mimeType: string | null): RecoveredPhotoDimensions {
  if (mimeType === "image/png" && header.length >= 24) {
    const width = header.readUInt32BE(16);
    const height = header.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (mimeType === "image/jpeg") return jpegDimensions(header);
  if (mimeType === "image/webp" && header.length >= 30 && header.toString("ascii", 12, 16) === "VP8X") {
    const width = 1 + header[24] + (header[25] << 8) + (header[26] << 16);
    const height = 1 + header[27] + (header[28] << 8) + (header[29] << 16);
    return { width, height };
  }
  return null;
}

async function readHeader(filePath: string): Promise<Buffer> {
  const noFollow = constants.O_NOFOLLOW ?? 0;
  const handle = await open(filePath, constants.O_RDONLY | noFollow);
  try {
    const buffer = Buffer.alloc(HEADER_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath, { highWaterMark: 1024 * 1024 })) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

function isMacMetadata(name: string): boolean {
  return name === ".DS_Store" || name.startsWith("._");
}

export async function auditRecoveredProductPhotos(
  root = DEFAULT_RECOVERED_PHOTO_ROOT,
): Promise<RecoveredPhotoAudit> {
  const absoluteRoot = path.resolve(root);
  const rootStats = await lstat(absoluteRoot);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error("Recovered product root must be a real directory, not a symbolic link.");
  }

  const rootEntries = await readdir(absoluteRoot, { withFileTypes: true });
  const folders: RecoveredPhotoFolder[] = [];
  const files: RecoveredPhotoFile[] = [];
  const errors: string[] = [];
  const fileTypeCounts: Record<string, number> = {};
  const detectedMimeCounts: Record<string, number> = {};
  let nestedDirectories = 0;
  let symbolicLinks = 0;
  let macosSidecars = 0;
  let unsupportedFiles = 0;
  let oversizedImages = 0;
  let invalidSignatures = 0;
  let extensionMimeMismatches = 0;
  let unreadableFiles = 0;

  for (const entry of rootEntries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name.startsWith(".")) {
      if (isMacMetadata(entry.name)) macosSidecars += 1;
      continue;
    }
    if (entry.isSymbolicLink()) {
      symbolicLinks += 1;
      errors.push(entry.name + ": symbolic links are not accepted.");
      continue;
    }
    if (!entry.isDirectory()) {
      errors.push(entry.name + ": unexpected root-level file; images must be in product folders.");
      continue;
    }

    const folderPath = path.join(absoluteRoot, entry.name);
    const children = await readdir(folderPath, { withFileTypes: true });
    const folder: RecoveredPhotoFolder = {
      folderName: entry.name,
      imageCount: 0,
      imageBytes: 0,
      empty: children.length === 0,
      noSupportedPhotos: true,
      oversizedImages: [],
      unsupportedFiles: [],
      nestedDirectories: [],
      ignoredSidecars: [],
      errors: [],
    };

    for (const child of children.sort((left, right) => left.name.localeCompare(right.name))) {
      if (child.name.startsWith(".")) {
        if (isMacMetadata(child.name)) {
          folder.ignoredSidecars.push(child.name);
          macosSidecars += 1;
        }
        continue;
      }
      if (child.isSymbolicLink()) {
        symbolicLinks += 1;
        folder.errors.push(child.name + ": symbolic links are not accepted.");
        continue;
      }
      if (child.isDirectory()) {
        nestedDirectories += 1;
        folder.nestedDirectories.push(child.name);
        continue;
      }
      if (!child.isFile()) {
        folder.errors.push(child.name + ": unsupported filesystem entry.");
        continue;
      }

      const filePath = path.join(folderPath, child.name);
      const extension = path.extname(child.name).toLowerCase();
      const expectedMimeType = IMAGE_MIME_BY_EXTENSION[extension];
      const extensionKey = extension || "[no-extension]";
      fileTypeCounts[extensionKey] = (fileTypeCounts[extensionKey] ?? 0) + 1;

      if (!expectedMimeType) {
        unsupportedFiles += 1;
        folder.unsupportedFiles.push(child.name);
        continue;
      }

      const stats = await lstat(filePath);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        symbolicLinks += 1;
        folder.errors.push(child.name + ": image is not a regular file.");
        continue;
      }

      folder.imageCount += 1;
      folder.imageBytes += stats.size;
      if (stats.size > MAX_RECOVERED_IMAGE_BYTES) {
        oversizedImages += 1;
        folder.oversizedImages.push(child.name);
      }

      const record: RecoveredPhotoFile = {
        folderName: entry.name,
        fileName: child.name,
        relativePath: path.join(entry.name, child.name).split(path.sep).join("/"),
        extension,
        sizeBytes: stats.size,
        detectedMimeType: null,
        sha256: null,
        dimensions: null,
        issues: [],
      };
      if (stats.size === 0) record.issues.push("empty_file");
      else {
        try {
          const header = await readHeader(filePath);
          record.detectedMimeType = detectImageMimeType(header);
          record.dimensions = readDimensions(header, record.detectedMimeType);
          if (!record.detectedMimeType) {
            invalidSignatures += 1;
            record.issues.push("invalid_signature");
          } else if (record.detectedMimeType !== expectedMimeType) {
            extensionMimeMismatches += 1;
            record.issues.push("extension_mime_mismatch");
          }
          const afterHash = await sha256File(filePath);
          const afterStats = await lstat(filePath);
          if (
            !afterStats.isFile()
            || afterStats.isSymbolicLink()
            || afterStats.size !== stats.size
            || afterStats.mtimeMs !== stats.mtimeMs
            || afterStats.ino !== stats.ino
          ) {
            throw new Error("file changed while it was being audited");
          }
          record.sha256 = afterHash;
        } catch (error) {
          unreadableFiles += 1;
          record.issues.push("read_error");
          folder.errors.push(child.name + ": " + (error instanceof Error ? error.message : "read failed"));
        }
      }
      if (record.detectedMimeType) {
        detectedMimeCounts[record.detectedMimeType] = (detectedMimeCounts[record.detectedMimeType] ?? 0) + 1;
      }
      if (record.issues.length === 0 && record.sizeBytes > MAX_RECOVERED_IMAGE_BYTES) {
        record.issues.push("oversized");
      }
      files.push(record);
    }

    folder.noSupportedPhotos = folder.imageCount === 0;
    folders.push(folder);
  }

  const byHash = new Map<string, RecoveredPhotoFile[]>();
  for (const file of files) {
    if (!file.sha256) continue;
    byHash.set(file.sha256, [...(byHash.get(file.sha256) ?? []), file]);
  }
  const duplicateGroups = [...byHash.entries()]
    .filter(([, matches]) => matches.length > 1)
    .map(([sha256, matches]) => ({
      sha256,
      sizeBytes: matches[0].sizeBytes,
      files: matches.map((file) => file.relativePath).sort(),
    }))
    .sort((left, right) => left.sha256.localeCompare(right.sha256));

  const imageFiles = files.length;
  return {
    root: absoluteRoot,
    generatedAt: new Date().toISOString(),
    limits: {
      maxImageBytes: MAX_RECOVERED_IMAGE_BYTES,
      supportedExtensions: Object.keys(IMAGE_MIME_BY_EXTENSION).sort(),
    },
    summary: {
      productFolders: folders.length,
      imageFiles,
      totalImageBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
      emptyProductFolders: folders.filter((folder) => folder.empty).length,
      foldersWithoutSupportedPhotos: folders.filter((folder) => folder.noSupportedPhotos).length,
      oversizedImages,
      unsupportedFiles,
      invalidSignatures,
      extensionMimeMismatches,
      unreadableFiles,
      nestedDirectories,
      symbolicLinks,
      macosSidecars,
      duplicateGroups: duplicateGroups.length,
      duplicateFiles: duplicateGroups.reduce((total, group) => total + group.files.length, 0),
      duplicateExtraCopies: duplicateGroups.reduce((total, group) => total + group.files.length - 1, 0),
    },
    fileTypeCounts,
    detectedMimeCounts,
    folders,
    files,
    duplicateGroups,
    errors: [
      ...errors,
      ...folders.flatMap((folder) => folder.errors.map((error) => folder.folderName + "/" + error)),
    ],
  };
}

function csvCell(value: string | number | boolean | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function recoveredPhotoInventoryCsv(files: RecoveredPhotoFile[]): string {
  const columns = [
    "relative_path", "folder_name", "file_name", "extension", "size_bytes",
    "detected_mime_type", "sha256", "width", "height", "issues",
  ];
  const rows = files.map((file) => [
    file.relativePath,
    file.folderName,
    file.fileName,
    file.extension,
    file.sizeBytes,
    file.detectedMimeType,
    file.sha256,
    file.dimensions?.width,
    file.dimensions?.height,
    file.issues.join(";"),
  ]);
  return [columns, ...rows].map((row) => row.map((value) => csvCell(value)).join(",")).join("\n") + "\n";
}
