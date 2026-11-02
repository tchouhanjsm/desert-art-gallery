import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  parseProductImageName,
  validateProductImageBytes,
} from "../src/lib/product-image-intake";

const intakeRoot = path.resolve(process.cwd(), ".local-data", "imports", "product-images");
const productSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function main() {
  let productDirectories;
  try {
    productDirectories = await readdir(intakeRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Image intake folder not found. Run npm run local:prepare first.");
    }
    throw error;
  }

  const problems: string[] = [];
  const validImages: string[] = [];
  let productFolders = 0;

  for (const entry of productDirectories) {
    if (entry.name.startsWith(".") || entry.name.startsWith("._")) continue;
    if (!entry.isDirectory()) {
      problems.push(entry.name + ": files must be placed inside a product-slug folder.");
      continue;
    }
    if (!productSlugPattern.test(entry.name)) {
      problems.push(entry.name + ": folder must be a verified lowercase product slug.");
      continue;
    }

    productFolders += 1;
    const folder = path.join(intakeRoot, entry.name);
    const children = await readdir(folder, { withFileTypes: true });
    const sequences = new Set<number>();
    let primaryCount = 0;

    for (const child of children) {
      if (child.name.startsWith(".") || child.name.startsWith("._")) continue;
      if (!child.isFile()) {
        problems.push(entry.name + "/" + child.name + ": nested folders and symbolic links are not accepted.");
        continue;
      }

      const parsed = parseProductImageName(child.name);
      if (!parsed) {
        problems.push(entry.name + "/" + child.name + ": invalid filename. Use 01-primary.jpg, 02-detail.webp, etc.");
        continue;
      }

      if (sequences.has(parsed.sequence)) {
        problems.push(entry.name + "/" + child.name + ": image sequence number is duplicated.");
        continue;
      }
      sequences.add(parsed.sequence);
      if (parsed.role === "primary") primaryCount += 1;

      const bytes = await readFile(path.join(folder, child.name));
      const validation = validateProductImageBytes(child.name, bytes);
      if (!validation.valid) {
        problems.push(entry.name + "/" + child.name + ": " + validation.reason);
        continue;
      }
      validImages.push(entry.name + "/" + child.name + " (" + validation.mimeType + ", " + Math.ceil(bytes.length / 1024) + " KB)");
    }

    if (primaryCount !== 1) {
      problems.push(entry.name + ": expected exactly one 01-primary image; found " + primaryCount + ".");
    }
  }

  process.stdout.write("Product image intake preview (read-only)\\n");
  process.stdout.write("Product folders: " + productFolders + "\\n");
  process.stdout.write("Valid image files: " + validImages.length + "\\n");
  for (const image of validImages) process.stdout.write("  " + image + "\\n");

  if (problems.length) {
    process.stderr.write("\\nItems requiring attention (" + problems.length + "):\\n");
    for (const problem of problems) process.stderr.write("  - " + problem + "\\n");
    process.exitCode = 1;
    return;
  }

  process.stdout.write("\\nAll files passed filename and signature checks. No files were uploaded, copied, published or written to MySQL.\\n");
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "Unable to preview product image intake.") + "\\n");
  process.exitCode = 1;
});
