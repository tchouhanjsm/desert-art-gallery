import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { auditRecoveredProductPhotos, recoveredPhotoInventoryCsv } from "./recovered-product-photo-audit";

const roots: string[] = [];
async function tempRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "dag-photo-audit-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("recovered product photo audit", () => {
  it("hashes originals, detects duplicate content and verifies signatures without modifying files", async () => {
    const root = await tempRoot();
    const jacket = path.join(root, "Banjara Jacket");
    const empty = path.join(root, "Empty Product");
    await mkdir(jacket);
    await mkdir(empty);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);
    await writeFile(path.join(jacket, "01-primary.jpg"), jpeg);
    await writeFile(path.join(jacket, "02-detail.jpeg"), jpeg);
    await writeFile(path.join(jacket, "03-invalid.jpg"), Buffer.from("not really jpeg"));
    await writeFile(path.join(jacket, "notes.txt"), "source note");
    await writeFile(path.join(jacket, "._02-detail.jpeg"), "macOS metadata");
    await writeFile(path.join(root, ".DS_Store"), "macOS metadata");
    await mkdir(path.join(jacket, "nested"));

    const report = await auditRecoveredProductPhotos(root);
    expect(report.summary.productFolders).toBe(2);
    expect(report.summary.imageFiles).toBe(3);
    expect(report.summary.emptyProductFolders).toBe(1);
    expect(report.summary.foldersWithoutSupportedPhotos).toBe(1);
    expect(report.summary.unsupportedFiles).toBe(1);
    expect(report.summary.invalidSignatures).toBe(1);
    expect(report.summary.duplicateGroups).toBe(1);
    expect(report.summary.duplicateFiles).toBe(2);
    expect(report.summary.duplicateExtraCopies).toBe(1);
    expect(report.summary.macosSidecars).toBe(2);
    expect(report.summary.nestedDirectories).toBe(1);
    expect(report.files[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.files[0].detectedMimeType).toBe("image/jpeg");
    expect(report.duplicateGroups[0].files).toHaveLength(2);
  });

  it("detects extension/signature mismatch, supported PNG signature and oversized images", async () => {
    const root = await tempRoot();
    const folder = path.join(root, "Mixed Product");
    await mkdir(folder);
    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
    png.writeUInt32BE(640, 16);
    png.writeUInt32BE(480, 20);
    await writeFile(path.join(folder, "01.png"), png);
    await writeFile(path.join(folder, "02.jpg"), png);
    const oversized = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(12 * 1024 * 1024)]);
    await writeFile(path.join(folder, "03.jpg"), oversized);

    const report = await auditRecoveredProductPhotos(root);
    expect(report.summary.extensionMimeMismatches).toBe(1);
    expect(report.summary.oversizedImages).toBe(1);
    expect(report.files.find((file) => file.fileName === "01.png")?.dimensions).toEqual({ width: 640, height: 480 });
    expect(report.files.find((file) => file.fileName === "02.jpg")?.issues).toContain("extension_mime_mismatch");
  });

  it("exports spreadsheet-safe CSV with content hashes and dimensions", async () => {
    const root = await tempRoot();
    const folder = path.join(root, "Formula Product");
    await mkdir(folder);
    await writeFile(path.join(folder, "01.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
    const report = await auditRecoveredProductPhotos(root);
    const csv = recoveredPhotoInventoryCsv(report.files);
    expect(csv).toContain("\"relative_path\"");
    expect(csv).toContain("\"Formula Product/01.jpg\"");
    expect(csv).toContain("\"sha256\"");
  });
});
