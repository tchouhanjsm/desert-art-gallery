import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { copyFile, lstat, mkdir, readFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import {
  MAX_PRODUCT_IMAGE_BYTES,
  validateProductImageBytes,
} from "../../lib/product-image-intake";

export const DEFAULT_RECOVERED_PHOTO_SOURCE_ROOT = path.resolve(
  process.cwd(), "public", "images", "products",
);
export const DEFAULT_RECOVERED_PHOTO_INTAKE_ROOT = path.resolve(
  process.cwd(), ".local-data", "imports", "product-images",
);
export const RECOVERED_PHOTO_STAGING_CONFIRMATION = "STAGE_OWNER_APPROVED_RECOVERED_PHOTOS";

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const PRODUCT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FILE_NAME_PATTERN = /^[^/\\]+$/;

export type RecoveredPhotoApproval = {
  folderName: string;
  ownerDecision: "APPROVED";
  approvedProductId: string;
  approvedProductSlug: string;
  primaryImageFilename: string;
  ownerNote: string;
  candidatePairs: Array<{ id: string; slug: string }>;
  expectedImageCount: number;
};

export type RecoveredPhotoApprovalParseResult = {
  approvals: RecoveredPhotoApproval[];
  pendingFolders: number;
  rejectedFolders: number;
  totalRows: number;
};

export type RecoveredPhotoCatalogueProduct = {
  id: string;
  slug: string;
  status: string;
  sourceMetadata: Record<string, unknown> | null;
};

export type RecoveredPhotoStagingFile = {
  folderName: string;
  productId: string;
  productSlug: string;
  sourceFilename: string;
  sourceRelativePath: string;
  targetFilename: string;
  targetRelativePath: string;
  sizeBytes: number;
  sha256: string;
  alreadyPresent: boolean;
};

export type RecoveredPhotoStagingPlan = {
  sourceRoot: string;
  targetRoot: string;
  approvedFolders: number;
  pendingFolders: number;
  rejectedFolders: number;
  sourceImages: number;
  filesToCopy: number;
  filesAlreadyPresent: number;
  totalBytes: number;
  files: RecoveredPhotoStagingFile[];
  errors: string[];
  warnings: string[];
  canStage: boolean;
};

export type RecoveredPhotoStagingResult = {
  foldersProcessed: number;
  filesCopied: number;
  existingFilesSkipped: number;
  bytesCopied: number;
};

type CsvRecord = { cells: string[]; line: number };

function parseCsvRecords(source: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let field = "";
  let quoted = false;
  let quoteClosed = false;
  let line = 1;
  let recordLine = 1;

  const finishField = () => {
    cells.push(field);
    field = "";
    quoteClosed = false;
  };
  const finishRecord = () => {
    finishField();
    records.push({ cells, line: recordLine });
    cells = [];
    recordLine = line + 1;
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        quoteClosed = true;
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        field += "\n";
        line += 1;
      } else {
        field += character;
      }
      continue;
    }
    if (quoteClosed) {
      if (character === ",") finishField();
      else if (character === "\r" || character === "\n") {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        finishRecord();
        line += 1;
        recordLine = line;
      } else if (character !== " " && character !== "\t") {
        throw new Error("Unexpected character after a closing quote on CSV line " + line + ".");
      }
      continue;
    }
    if (character === '"') {
      if (field.length > 0) throw new Error("Unexpected quote inside an unquoted CSV field on line " + line + ".");
      quoted = true;
    } else if (character === ",") finishField();
    else if (character === "\r" || character === "\n") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      finishRecord();
      line += 1;
      recordLine = line;
    } else field += character;
  }
  if (quoted) throw new Error("The owner mapping CSV contains an unterminated quoted field.");
  if (field.length > 0 || cells.length > 0 || quoteClosed) finishRecord();
  return records.filter((record) => record.cells.some((cell) => cell.trim() !== ""));
}

function requireSafeName(value: string, label: string): string {
  const name = value.trim();
  if (!name || name === "." || name === ".." || !FILE_NAME_PATTERN.test(name) || name.startsWith(".")) {
    throw new Error(label + " must be a single safe folder/file name.");
  }
  return name;
}

function parsePositiveInteger(value: string, label: string): number {
  if (!/^[1-9]\d*$/.test(value.trim())) throw new Error(label + " must be a positive whole number.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(label + " exceeds the safe integer range.");
  return parsed;
}

export function parseRecoveredPhotoApprovalCsv(source: string): RecoveredPhotoApprovalParseResult {
  const records = parseCsvRecords(source.replace(/^\uFEFF/, ""));
  if (records.length < 2) throw new Error("The owner mapping CSV must contain a header and at least one folder row.");

  const headers = records[0].cells.map((cell) => cell.trim().toLowerCase());
  const required = [
    "recovered_folder",
    "candidate_product_ids",
    "candidate_product_slugs",
    "image_count",
    "owner_decision",
    "approved_product_id",
    "approved_product_slug",
    "primary_image_filename",
    "owner_note",
  ];
  const duplicateHeaders = headers.filter((name, index) => headers.indexOf(name) !== index);
  if (duplicateHeaders.length) throw new Error("The owner mapping CSV contains duplicate column names.");
  const missingHeaders = required.filter((name) => !headers.includes(name));
  if (missingHeaders.length) throw new Error("The owner mapping CSV is missing columns: " + missingHeaders.join(", ") + ".");
  const indexByName = new Map(headers.map((name, index) => [name, index]));
  const value = (record: CsvRecord, name: string) => record.cells[indexByName.get(name) ?? -1]?.trim() ?? "";
  const seenFolders = new Set<string>();
  const seenProducts = new Set<string>();
  const approvals: RecoveredPhotoApproval[] = [];
  let pendingFolders = 0;
  let rejectedFolders = 0;

  for (const record of records.slice(1)) {
    if (record.cells.length !== headers.length) {
      throw new Error("Owner mapping CSV line " + record.line + " has an unexpected number of columns.");
    }
    const folderName = requireSafeName(value(record, "recovered_folder"), "Recovered folder");
    if (seenFolders.has(folderName)) throw new Error("Duplicate recovered folder in owner mapping CSV: " + folderName + ".");
    seenFolders.add(folderName);

    const decision = value(record, "owner_decision").toUpperCase();
    if (decision === "NOT_REVIEWED" || decision === "HOLD" || decision === "") {
      pendingFolders += 1;
      continue;
    }
    if (decision === "REJECTED") {
      rejectedFolders += 1;
      continue;
    }
    if (decision !== "APPROVED") {
      throw new Error("Owner decision for " + folderName + " must be APPROVED, REJECTED, HOLD or NOT_REVIEWED.");
    }

    const approvedProductId = value(record, "approved_product_id");
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(approvedProductId)) {
      throw new Error("Approved product ID is missing or malformed for " + folderName + ".");
    }
    const approvedProductSlug = value(record, "approved_product_slug");
    if (!PRODUCT_SLUG_PATTERN.test(approvedProductSlug)) {
      throw new Error("Approved product slug is missing or malformed for " + folderName + ".");
    }
    const primaryImageFilename = requireSafeName(value(record, "primary_image_filename"), "Primary image filename");
    if (!SUPPORTED_EXTENSIONS.has(path.extname(primaryImageFilename).toLowerCase())) {
      throw new Error("Primary image for " + folderName + " must use JPEG, PNG, WebP or AVIF.");
    }
    const ownerNote = value(record, "owner_note");
    if (ownerNote.length < 12) {
      throw new Error("Owner note for " + folderName + " must explain the approval (at least 12 characters).");
    }
    const candidateIds = value(record, "candidate_product_ids").split(";").map((item) => item.trim()).filter(Boolean);
    const candidateSlugs = value(record, "candidate_product_slugs").split(";").map((item) => item.trim()).filter(Boolean);
    if (candidateIds.length !== candidateSlugs.length) {
      throw new Error("Candidate product IDs/slugs are not aligned for " + folderName + ".");
    }
    const candidatePairs = candidateIds.map((id, index) => ({ id, slug: candidateSlugs[index] }));
    const targetKey = approvedProductId + ":" + approvedProductSlug;
    if (seenProducts.has(targetKey)) {
      throw new Error("A product was approved for more than one recovered folder: " + approvedProductSlug + ".");
    }
    seenProducts.add(targetKey);

    approvals.push({
      folderName,
      ownerDecision: "APPROVED",
      approvedProductId,
      approvedProductSlug,
      primaryImageFilename,
      ownerNote,
      candidatePairs,
      expectedImageCount: parsePositiveInteger(value(record, "image_count"), "Image count for " + folderName),
    });
  }

  return { approvals, pendingFolders, rejectedFolders, totalRows: records.length - 1 };
}

export function validateRecoveredPhotoApprovalsAgainstCatalogue(
  approvals: RecoveredPhotoApproval[],
  catalogueProducts: RecoveredPhotoCatalogueProduct[],
): string[] {
  const byId = new Map(catalogueProducts.map((product) => [product.id, product]));
  const errors: string[] = [];
  for (const approval of approvals) {
    const product = byId.get(approval.approvedProductId);
    if (!product) {
      errors.push(approval.folderName + ": approved product ID does not exist in the connected MySQL catalogue.");
      continue;
    }
    if (product.slug !== approval.approvedProductSlug) {
      errors.push(approval.folderName + ": approved product ID and slug do not identify the same catalogue record.");
    }
    if (product.status !== "draft") {
      errors.push(approval.folderName + ": product " + product.slug + " is not a draft; recovered-photo staging only accepts drafts.");
    }
    if (product.sourceMetadata?.provider !== "etsy") {
      errors.push(approval.folderName + ": product " + product.slug + " is not identified as an Etsy source listing.");
    }
    const wasCandidate = approval.candidatePairs.some((candidate) =>
      candidate.id === product.id && candidate.slug === product.slug,
    );
    if (!wasCandidate && approval.ownerNote.length < 20) {
      errors.push(approval.folderName + ": manual product overrides require a more detailed owner note (at least 20 characters).");
    }
  }
  return errors;
}

async function assertDirectoryPath(workspaceRoot: string, destination: string, allowMissing: boolean): Promise<void> {
  const base = path.resolve(workspaceRoot);
  const target = path.resolve(destination);
  const relative = path.relative(base, target);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    throw new Error("Recovered-photo staging paths must remain inside the repository workspace.");
  }
  const baseStats = await lstat(base);
  if (!baseStats.isDirectory() || baseStats.isSymbolicLink()) {
    throw new Error("Workspace root must be a real directory, not a symbolic link.");
  }
  let cursor = base;
  for (const segment of relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    try {
      const stats = await lstat(cursor);
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw new Error("Staging path contains a symbolic link or non-directory: " + path.relative(base, cursor) + ".");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && allowMissing) return;
      throw error;
    }
  }
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath, { highWaterMark: 1024 * 1024 })) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function inspectImageFile(filePath: string, displayName: string): Promise<{ sizeBytes: number; sha256: string }> {
  const before = await lstat(filePath);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error(displayName + " is not a regular file.");
  if (before.size < 1 || before.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error(displayName + " must be between 1 byte and 12 MB.");
  }
  const bytes = await readFile(filePath);
  const validationName = "01-detail" + path.extname(displayName).toLowerCase();
  const validation = validateProductImageBytes(validationName, bytes);
  if (!validation.valid) throw new Error(displayName + ": " + validation.reason);
  const after = await lstat(filePath);
  if (!after.isFile() || after.isSymbolicLink() || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ino !== before.ino) {
    throw new Error(displayName + " changed while it was being validated.");
  }
  return { sizeBytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function previewRecoveredPhotoStaging(
  parsed: RecoveredPhotoApprovalParseResult,
  options: {
    workspaceRoot?: string;
    sourceRoot?: string;
    targetRoot?: string;
  } = {},
): Promise<RecoveredPhotoStagingPlan> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const sourceRoot = path.resolve(options.sourceRoot ?? DEFAULT_RECOVERED_PHOTO_SOURCE_ROOT);
  const targetRoot = path.resolve(options.targetRoot ?? DEFAULT_RECOVERED_PHOTO_INTAKE_ROOT);
  const errors: string[] = [];
  const warnings: string[] = [];
  const files: RecoveredPhotoStagingFile[] = [];

  try {
    await assertDirectoryPath(workspaceRoot, sourceRoot, false);
    await assertDirectoryPath(workspaceRoot, targetRoot, true);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Recovered-photo source/target path validation failed.");
  }

  for (const approval of parsed.approvals) {
    const sourceFolder = path.join(sourceRoot, approval.folderName);
    let entries;
    try {
      const folderStats = await lstat(sourceFolder);
      if (!folderStats.isDirectory() || folderStats.isSymbolicLink()) {
        throw new Error("Recovered source folder is not a real directory.");
      }
      entries = await readdir(sourceFolder, { withFileTypes: true });
    } catch (error) {
      errors.push(approval.folderName + ": " + (error instanceof Error ? error.message : "Unable to read recovered folder."));
      continue;
    }

    const visibleFiles = entries.filter((entry) => !entry.name.startsWith("."));
    const imageEntries = [];
    for (const entry of visibleFiles) {
      if (entry.isSymbolicLink() || entry.isDirectory() || !entry.isFile()) {
        errors.push(approval.folderName + "/" + entry.name + ": nested folders, special files and symbolic links are blocked.");
        continue;
      }
      if (!SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        errors.push(approval.folderName + "/" + entry.name + ": unsupported non-image file blocks staging.");
        continue;
      }
      imageEntries.push(entry);
    }
    if (imageEntries.length !== approval.expectedImageCount) {
      errors.push(approval.folderName + ": approved image count is " + approval.expectedImageCount +
        " but the source folder currently contains " + imageEntries.length + " supported images.");
      continue;
    }
    if (imageEntries.length < 1 || imageEntries.length > 99) {
      errors.push(approval.folderName + ": staging requires between 1 and 99 supported images.");
      continue;
    }
    if (!imageEntries.some((entry) => entry.name === approval.primaryImageFilename)) {
      errors.push(approval.folderName + ": selected primary image does not exist with the exact filename.");
      continue;
    }

    const ordered = [
      ...imageEntries.filter((entry) => entry.name === approval.primaryImageFilename),
      ...imageEntries.filter((entry) => entry.name !== approval.primaryImageFilename)
        .sort((left, right) => left.name.localeCompare(right.name)),
    ];
    let folderFailed = false;
    const folderFiles: RecoveredPhotoStagingFile[] = [];
    for (let index = 0; index < ordered.length; index += 1) {
      const entry = ordered[index];
      const sourcePath = path.join(sourceFolder, entry.name);
      try {
        const inspected = await inspectImageFile(sourcePath, approval.folderName + "/" + entry.name);
        const extension = path.extname(entry.name).toLowerCase();
        const targetFilename = String(index + 1).padStart(2, "0") +
          (index === 0 ? "-primary" : "-detail") + extension;
        const targetPath = path.join(targetRoot, approval.approvedProductSlug, targetFilename);
        let alreadyPresent = false;
        try {
          const existingStats = await lstat(targetPath);
          if (!existingStats.isFile() || existingStats.isSymbolicLink()) {
            throw new Error("Existing intake destination is not a regular file.");
          }
          const existingHash = await hashFile(targetPath);
          if (existingStats.size !== inspected.sizeBytes || existingHash !== inspected.sha256) {
            throw new Error("A different file already exists at the staging destination; no overwrite is permitted.");
          }
          alreadyPresent = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        const targetRelativePath = path.relative(workspaceRoot, targetPath).split(path.sep).join("/");
        folderFiles.push({
          folderName: approval.folderName,
          productId: approval.approvedProductId,
          productSlug: approval.approvedProductSlug,
          sourceFilename: entry.name,
          sourceRelativePath: path.join(approval.folderName, entry.name).split(path.sep).join("/"),
          targetFilename,
          targetRelativePath,
          sizeBytes: inspected.sizeBytes,
          sha256: inspected.sha256,
          alreadyPresent,
        });
      } catch (error) {
        errors.push(approval.folderName + "/" + entry.name + ": " + (error instanceof Error ? error.message : "Image validation failed."));
        folderFailed = true;
      }
    }
    if (!folderFailed) files.push(...folderFiles);
  }

  const approvedFolders = parsed.approvals.length;
  const totalBytes = files.reduce((total, file) => total + file.sizeBytes, 0);
  const filesAlreadyPresent = files.filter((file) => file.alreadyPresent).length;
  if (approvedFolders === 0) warnings.push("No folders have owner_decision=APPROVED; no photos are eligible for staging.");
  if (parsed.pendingFolders > 0) warnings.push(parsed.pendingFolders + " folder(s) remain NOT_REVIEWED or on HOLD.");
  if (parsed.rejectedFolders > 0) warnings.push(parsed.rejectedFolders + " folder(s) were explicitly rejected.");
  return {
    sourceRoot,
    targetRoot,
    approvedFolders,
    pendingFolders: parsed.pendingFolders,
    rejectedFolders: parsed.rejectedFolders,
    sourceImages: files.length,
    filesToCopy: files.length - filesAlreadyPresent,
    filesAlreadyPresent,
    totalBytes,
    files,
    errors,
    warnings,
    canStage: errors.length === 0 && approvedFolders > 0 && files.length > 0,
  };
}

export async function commitRecoveredPhotoStaging(
  confirmation: string,
  plan: RecoveredPhotoStagingPlan,
  workspaceRoot = process.cwd(),
): Promise<RecoveredPhotoStagingResult> {
  if (confirmation !== RECOVERED_PHOTO_STAGING_CONFIRMATION) {
    throw new Error("Pass the explicit " + RECOVERED_PHOTO_STAGING_CONFIRMATION + " confirmation before copying recovered photographs.");
  }
  if (process.env.NODE_ENV === "production") throw new Error("Recovered-photo staging is blocked when NODE_ENV=production.");
  if (!plan.canStage || plan.errors.length) throw new Error("Recovered-photo staging is not ready. " + plan.errors.join(" "));
  if (!plan.files.length) throw new Error("No approved recovered photographs are eligible for staging.");

  const createdPaths: string[] = [];
  let bytesCopied = 0;
  let existingFilesSkipped = 0;
  try {
    await assertDirectoryPath(workspaceRoot, plan.targetRoot, true);
    for (const file of plan.files) {
      if (file.alreadyPresent) {
        existingFilesSkipped += 1;
        continue;
      }
      const sourcePath = path.join(plan.sourceRoot, file.sourceRelativePath);
      const targetPath = path.join(plan.targetRoot, file.productSlug, file.targetFilename);
      const current = await inspectImageFile(sourcePath, file.sourceRelativePath);
      if (current.sha256 !== file.sha256 || current.sizeBytes !== file.sizeBytes) {
        throw new Error(file.sourceRelativePath + " changed after preview. Rebuild the staging preview.");
      }
      await mkdir(path.dirname(targetPath), { recursive: true, mode: 0o700 });
      await assertDirectoryPath(workspaceRoot, path.dirname(targetPath), false);
      try {
        await copyFile(sourcePath, targetPath, constants.COPYFILE_EXCL);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          const existing = await inspectImageFile(targetPath, file.targetRelativePath);
          if (existing.sha256 === file.sha256 && existing.sizeBytes === file.sizeBytes) {
            existingFilesSkipped += 1;
            continue;
          }
          throw new Error(file.targetRelativePath + " appeared with different content after preview; overwrite was refused.");
        }
        throw error;
      }
      createdPaths.push(targetPath);
      const copied = await inspectImageFile(targetPath, file.targetRelativePath);
      if (copied.sha256 !== file.sha256 || copied.sizeBytes !== file.sizeBytes) {
        throw new Error("Copied image verification failed for " + file.targetRelativePath + ".");
      }
      bytesCopied += copied.sizeBytes;
    }
  } catch (error) {
    const rollbackFailures: string[] = [];
    for (const createdPath of createdPaths.reverse()) {
      try {
        await unlink(createdPath);
      } catch (rollbackError) {
        rollbackFailures.push(path.relative(workspaceRoot, createdPath) + ": " +
          (rollbackError instanceof Error ? rollbackError.message : "unable to remove staged copy"));
      }
    }
    const message = error instanceof Error ? error.message : "Recovered-photo staging failed.";
    if (rollbackFailures.length) {
      throw new Error(message + " Rollback also failed for: " + rollbackFailures.join("; "));
    }
    throw error;
  }

  return {
    foldersProcessed: new Set(plan.files.map((file) => file.productSlug)).size,
    filesCopied: createdPaths.length,
    existingFilesSkipped,
    bytesCopied,
  };
}
