import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  commitRecoveredPhotoStaging,
  parseRecoveredPhotoApprovalCsv,
  previewRecoveredPhotoStaging,
  RECOVERED_PHOTO_STAGING_CONFIRMATION,
  validateRecoveredPhotoApprovalsAgainstCatalogue,
  type RecoveredPhotoCatalogueProduct,
} from "./recovered-product-photo-staging";

const temporaryRoots: string[] = [];

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "dag-photo-staging-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function csvRow(overrides: Record<string, string> = {}): string {
  const values = {
    recovered_folder: "Recovered Jacket",
    candidate_product_ids: "product-12345678",
    candidate_product_slugs: "banjara-jacket-123",
    image_count: "2",
    owner_decision: "APPROVED",
    approved_product_id: "product-12345678",
    approved_product_slug: "banjara-jacket-123",
    primary_image_filename: "front.jpg",
    owner_note: "Inspected the source images and confirmed this exact listing.",
    ...overrides,
  };
  const headers = Object.keys(values) as Array<keyof typeof values>;
  const cell = (value: string) => '"' + value.replace(/"/g, '""') + '"';
  return [headers.join(","), headers.map((header) => cell(values[header])).join(",")].join("\r\n") + "\r\n";
}

function product(overrides: Partial<RecoveredPhotoCatalogueProduct> = {}): RecoveredPhotoCatalogueProduct {
  return {
    id: "product-12345678",
    slug: "banjara-jacket-123",
    status: "draft",
    sourceMetadata: { provider: "etsy" },
    ...overrides,
  };
}

async function createSourceFiles(workspace: string): Promise<{ sourceRoot: string; targetRoot: string }> {
  const sourceRoot = path.join(workspace, "public", "images", "products");
  const folder = path.join(sourceRoot, "Recovered Jacket");
  const targetRoot = path.join(workspace, ".local-data", "imports", "product-images");
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "front.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0x01]));
  await writeFile(path.join(folder, "detail.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x02]));
  return { sourceRoot, targetRoot };
}

describe("recovered product photo approval and staging", () => {
  it("keeps generated mapping rows pending until the owner approves them", () => {
    const csv = csvRow({ owner_decision: "NOT_REVIEWED", approved_product_id: "", approved_product_slug: "", primary_image_filename: "", owner_note: "" });
    const parsed = parseRecoveredPhotoApprovalCsv(csv);
    expect(parsed.approvals).toHaveLength(0);
    expect(parsed.pendingFolders).toBe(1);
  });

  it("parses quoted commas and embedded newlines in owner review notes", () => {
    const note = 'Reviewed "front, collar" and the full reverse side.\nConfirmed the product against the source listing.';
    const parsed = parseRecoveredPhotoApprovalCsv(csvRow({ owner_note: note }));
    expect(parsed.approvals[0]?.ownerNote).toBe(note);
  });

  it("requires an owner note, exact product identifiers and an explicit primary image", () => {
    expect(() => parseRecoveredPhotoApprovalCsv(csvRow({ owner_note: "ok" }))).toThrow(/owner note/i);
    expect(() => parseRecoveredPhotoApprovalCsv(csvRow({ approved_product_slug: "../outside" }))).toThrow(/product slug/i);
    expect(() => parseRecoveredPhotoApprovalCsv(csvRow({ primary_image_filename: "../front.jpg" }))).toThrow(/safe folder\/file name/i);
  });

  it("requires the approved product to be an Etsy draft and an exact ID/slug pair", () => {
    const parsed = parseRecoveredPhotoApprovalCsv(csvRow());
    expect(validateRecoveredPhotoApprovalsAgainstCatalogue(parsed.approvals, [product()])).toEqual([]);
    expect(validateRecoveredPhotoApprovalsAgainstCatalogue(parsed.approvals, [product({ status: "published" })])).toContainEqual(
      expect.stringContaining("not a draft"),
    );
    expect(validateRecoveredPhotoApprovalsAgainstCatalogue(parsed.approvals, [product({ slug: "other-slug" })])).toContainEqual(
      expect.stringContaining("do not identify the same"),
    );
    expect(validateRecoveredPhotoApprovalsAgainstCatalogue(parsed.approvals, [product({ sourceMetadata: { provider: "manual" } })])).toContainEqual(
      expect.stringContaining("not identified as an Etsy"),
    );
  });

  it("rejects duplicate product assignment and misaligned candidate identifiers", () => {
    const duplicateCsv = [
      csvRow(),
      csvRow({ recovered_folder: "Second Recovered Folder" }).split("\r\n")[1],
    ].join("");
    expect(() => parseRecoveredPhotoApprovalCsv(duplicateCsv)).toThrow(/more than one recovered folder/i);
    expect(() => parseRecoveredPhotoApprovalCsv(csvRow({
      candidate_product_ids: "product-12345678;product-87654321",
      candidate_product_slugs: "banjara-jacket-123",
    }))).toThrow(/not aligned/i);
  });

  it("requires a stronger note for a product override not listed as a title candidate", () => {
    const parsed = parseRecoveredPhotoApprovalCsv(csvRow({ candidate_product_ids: "", candidate_product_slugs: "" }));
    expect(validateRecoveredPhotoApprovalsAgainstCatalogue(parsed.approvals, [product()])).toContainEqual(
      expect.stringContaining("manual product overrides require"),
    );
    const detailed = parseRecoveredPhotoApprovalCsv(csvRow({
      candidate_product_ids: "",
      candidate_product_slugs: "",
      owner_note: "Owner inspected every source image and manually verified the original listing against the archive.",
    }));
    expect(validateRecoveredPhotoApprovalsAgainstCatalogue(detailed.approvals, [product()])).toEqual([]);
  });

  it("previews without modifying originals or writing to the private intake folder", async () => {
    const workspace = await createWorkspace();
    const roots = await createSourceFiles(workspace);
    const original = await readFile(path.join(roots.sourceRoot, "Recovered Jacket", "front.jpg"));
    const parsed = parseRecoveredPhotoApprovalCsv(csvRow());
    const plan = await previewRecoveredPhotoStaging(parsed, { workspaceRoot: workspace, ...roots });
    expect(plan.canStage).toBe(true);
    expect(plan.filesToCopy).toBe(2);
    expect(await readFile(path.join(roots.sourceRoot, "Recovered Jacket", "front.jpg"))).toEqual(original);
    await expect(readdir(roots.targetRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("copies approved originals into importer-compatible names without modifying the source", async () => {
    const workspace = await createWorkspace();
    const roots = await createSourceFiles(workspace);
    const parsed = parseRecoveredPhotoApprovalCsv(csvRow());
    const plan = await previewRecoveredPhotoStaging(parsed, { workspaceRoot: workspace, ...roots });
    const result = await commitRecoveredPhotoStaging(RECOVERED_PHOTO_STAGING_CONFIRMATION, plan, workspace);
    expect(result).toMatchObject({ foldersProcessed: 1, filesCopied: 2, existingFilesSkipped: 0 });
    expect(await readFile(path.join(roots.sourceRoot, "Recovered Jacket", "front.jpg"))).toEqual(
      Buffer.from([0xff, 0xd8, 0xff, 0x01]),
    );
    expect(await readFile(path.join(roots.targetRoot, "banjara-jacket-123", "01-primary.jpg"))).toEqual(
      Buffer.from([0xff, 0xd8, 0xff, 0x01]),
    );
    expect(await readFile(path.join(roots.targetRoot, "banjara-jacket-123", "02-detail.png"))).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x02]),
    );
  });

  it("is idempotent for identical destinations and refuses a different existing file", async () => {
    const workspace = await createWorkspace();
    const roots = await createSourceFiles(workspace);
    const parsed = parseRecoveredPhotoApprovalCsv(csvRow());
    const firstPlan = await previewRecoveredPhotoStaging(parsed, { workspaceRoot: workspace, ...roots });
    await commitRecoveredPhotoStaging(RECOVERED_PHOTO_STAGING_CONFIRMATION, firstPlan, workspace);
    const secondPlan = await previewRecoveredPhotoStaging(parsed, { workspaceRoot: workspace, ...roots });
    expect(secondPlan.filesAlreadyPresent).toBe(2);
    const second = await commitRecoveredPhotoStaging(RECOVERED_PHOTO_STAGING_CONFIRMATION, secondPlan, workspace);
    expect(second).toMatchObject({ filesCopied: 0, existingFilesSkipped: 2 });

    await writeFile(path.join(roots.targetRoot, "banjara-jacket-123", "01-primary.jpg"), "different");
    const conflict = await previewRecoveredPhotoStaging(parsed, { workspaceRoot: workspace, ...roots });
    expect(conflict.canStage).toBe(false);
    expect(conflict.errors.join(" ")).toContain("overwrite is permitted");
    await expect(commitRecoveredPhotoStaging(RECOVERED_PHOTO_STAGING_CONFIRMATION, conflict, workspace)).rejects.toThrow(/not ready/i);
  });

  it("blocks nested directories and unreviewed files from entering an approved batch", async () => {
    const workspace = await createWorkspace();
    const roots = await createSourceFiles(workspace);
    await mkdir(path.join(roots.sourceRoot, "Recovered Jacket", "nested"));
    const parsed = parseRecoveredPhotoApprovalCsv(csvRow());
    const plan = await previewRecoveredPhotoStaging(parsed, { workspaceRoot: workspace, ...roots });
    expect(plan.canStage).toBe(false);
    expect(plan.errors.join(" ")).toContain("nested folders");
  });

  it("blocks a symlinked product destination before creating anything outside the workspace", async () => {
    const workspace = await createWorkspace();
    const roots = await createSourceFiles(workspace);
    const outside = await mkdtemp(path.join(tmpdir(), "dag-photo-outside-"));
    temporaryRoots.push(outside);
    await mkdir(roots.targetRoot, { recursive: true });
    await symlink(outside, path.join(roots.targetRoot, "banjara-jacket-123"), "dir");
    const parsed = parseRecoveredPhotoApprovalCsv(csvRow());
    const plan = await previewRecoveredPhotoStaging(parsed, { workspaceRoot: workspace, ...roots });
    expect(plan.canStage).toBe(false);
    expect(plan.errors.join(" ")).toContain("symbolic link");
    expect(await readdir(outside)).toEqual([]);
  });

  it("rolls back only files created by the current batch when a source changes mid-run", async () => {
    const workspace = await createWorkspace();
    const roots = await createSourceFiles(workspace);
    const parsed = parseRecoveredPhotoApprovalCsv(csvRow());
    const plan = await previewRecoveredPhotoStaging(parsed, { workspaceRoot: workspace, ...roots });
    await writeFile(path.join(roots.sourceRoot, "Recovered Jacket", "detail.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x03]));
    await expect(
      commitRecoveredPhotoStaging(RECOVERED_PHOTO_STAGING_CONFIRMATION, plan, workspace),
    ).rejects.toThrow(/changed after preview/i);
    await expect(
      readFile(path.join(roots.targetRoot, "banjara-jacket-123", "01-primary.jpg")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(path.join(roots.sourceRoot, "Recovered Jacket", "front.jpg"))).toEqual(
      Buffer.from([0xff, 0xd8, 0xff, 0x01]),
    );
  });

  it("blocks a primary filename that is absent from the selected recovered folder", async () => {
    const workspace = await createWorkspace();
    const roots = await createSourceFiles(workspace);
    const parsed = parseRecoveredPhotoApprovalCsv(csvRow({ primary_image_filename: "missing.jpg" }));
    const plan = await previewRecoveredPhotoStaging(parsed, { workspaceRoot: workspace, ...roots });
    expect(plan.canStage).toBe(false);
    expect(plan.errors.join(" ")).toContain("selected primary image does not exist");
  });
});
