"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireLocalAdmin } from "@/server/auth/local-admin";
import { isMySqlCatalogueEnabled } from "@/server/db";
import {
  commitLocalCatalogueCsv,
  previewLocalCatalogueCsv,
  type LocalCatalogueImportPreview,
  type LocalCatalogueImportResult,
} from "@/server/catalogue/import-csv";

export type MySqlCataloguePreviewActionResult =
  | { ok: true; preview: LocalCatalogueImportPreview }
  | { ok: false; error: string };

export type MySqlCatalogueCommitActionResult =
  | { ok: true; result: LocalCatalogueImportResult }
  | { ok: false; error: string };

function safeActionError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (!message) return fallback;
  if (/(DATABASE_URL|mysql:\/\/|SQLSTATE|ECONN|ER_ACCESS_DENIED|password|secret|socket|127\.0\.0\.1|192\.168\.)/i.test(message)) {
    return fallback;
  }
  return message.slice(0, 600);
}

async function requireImportAdmin() {
  if (!isMySqlCatalogueEnabled()) {
    throw new Error("Enable the MySQL catalogue before using catalogue imports.");
  }
  return requireLocalAdmin();
}

async function readCsvUpload(formData: FormData): Promise<{ name: string; bytes: Uint8Array }> {
  const upload = formData.get("file");
  if (!(upload instanceof File)) throw new Error("Choose a CSV file first.");
  if (!upload.name.toLowerCase().endsWith(".csv")) throw new Error("The source file must have a .csv extension.");
  if (upload.size < 1 || upload.size > 2 * 1024 * 1024) throw new Error("Choose a CSV between 1 byte and 2 MB.");
  return { name: upload.name, bytes: new Uint8Array(await upload.arrayBuffer()) };
}

export async function previewMySqlCatalogueImport(
  formData: FormData,
): Promise<MySqlCataloguePreviewActionResult> {
  try {
    await requireImportAdmin();
    const upload = await readCsvUpload(formData);
    const preview = await previewLocalCatalogueCsv(upload.name, upload.bytes);
    return { ok: true, preview };
  } catch (error) {
    return {
      ok: false,
      error: safeActionError(error, "Unable to validate this file against the local MySQL catalogue. Check the database connection and server logs."),
    };
  }
}

export async function commitMySqlCatalogueImport(
  formData: FormData,
): Promise<MySqlCatalogueCommitActionResult> {
  try {
    const admin = await requireImportAdmin();
    if (formData.get("confirm_import") !== "yes") {
      throw new Error("Confirm the import in the owner workspace before writing catalogue records.");
    }
    const expectedHash = formData.get("expected_sha256");
    if (typeof expectedHash !== "string" || !/^[a-f0-9]{64}$/.test(expectedHash)) {
      throw new Error("The preview confirmation is missing or invalid. Preview the same file again.");
    }

    const upload = await readCsvUpload(formData);
    const actualHash = createHash("sha256").update(upload.bytes).digest("hex");
    if (actualHash !== expectedHash) {
      throw new Error("The selected CSV changed after preview. Run validation again before importing.");
    }

    const result = await commitLocalCatalogueCsv(
      upload.name,
      upload.bytes,
      "IMPORT_TO_LOCAL_MYSQL",
      admin.id,
    );
    revalidatePath("/admin/products");
    revalidatePath("/admin/products/import");
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error: safeActionError(error, "Catalogue import could not be completed. Check the local MySQL connection and server logs."),
    };
  }
}
