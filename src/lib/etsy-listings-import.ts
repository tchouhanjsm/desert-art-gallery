import type { ProductImportRow } from "./product-import";

export type EtsyListingImportRow = ProductImportRow & {
  tags: string[];
  sourceSku: string | null;
  sourceImageUrls: string[];
  warnings: string[];
  sourceMetadata: Record<string, unknown>;
};

export type EtsyListingsParseResult = {
  rows: EtsyListingImportRow[];
  errors: string[];
};

type CsvRecord = { cells: string[]; line: number };

const REQUIRED_HEADERS = ["TITLE", "DESCRIPTION", "PRICE", "CURRENCY_CODE", "QUANTITY"];
const MAX_ROWS = 1000;

function readCsvRecords(source: string): CsvRecord[] {
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
      if (character === ",") {
        finishField();
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        finishRecord();
        line += 1;
        recordLine = line;
      } else if (character !== " " && character !== "\t") {
        throw new Error("Unexpected character after a closing quote on line " + line + ".");
      }
      continue;
    }
    if (character === '"') {
      if (field.length > 0) throw new Error("Unexpected quote inside an unquoted field on line " + line + ".");
      quoted = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      finishRecord();
      line += 1;
      recordLine = line;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("The CSV contains an unterminated quoted field starting before line " + recordLine + ".");
  if (field.length > 0 || cells.length > 0 || quoteClosed) finishRecord();
  return records;
}

function nonBlankRecords(source: string): CsvRecord[] {
  return readCsvRecords(source.replace(/^\uFEFF/, ""))
    .filter((record) => record.cells.some((cell) => cell.trim() !== ""));
}

export function isAllowedEtsyImageUrl(value: string): boolean {
  if (!value || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname.toLowerCase() === "i.etsystatic.com"
      && !url.username
      && !url.password
      && !url.port;
  } catch {
    return false;
  }
}

export function isEtsyListingsCsv(source: string): boolean {
  try {
    const first = nonBlankRecords(source)[0];
    if (!first) return false;
    const headers = first.cells.map((cell) => cell.trim().toUpperCase());
    return REQUIRED_HEADERS.every((name) => headers.includes(name))
      && headers.some((name) => /^IMAGE(?:[1-9]|10)$/.test(name));
  } catch {
    return false;
  }
}

function slugify(value: string): string {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 125);
}

function stableHash(value: string): string {
  let hash = 14695981039346656037n;
  const prime = 1099511628211n;
  const mask = (1n << 64n) - 1n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return hash.toString(36).padStart(13, "0");
}

function currencyDigits(currency: string): number {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO currency code.");
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    throw new Error("Currency is not supported: " + currency + ".");
  }
}

function toMinorUnits(raw: string, currency: string): number {
  if (!raw) throw new Error("A listing price is required.");
  const digits = currencyDigits(currency);
  const pattern = digits === 0
    ? /^(0|[1-9]\d*)$/
    : new RegExp("^(0|[1-9]\\d*)(?:\\.(\\d{1," + digits + "}))?$");
  const match = raw.match(pattern);
  if (!match) throw new Error("Price must be a plain decimal amount with no more than " + digits + " fractional digits.");
  const whole = Number(match[1]);
  const fraction = digits === 0 ? 0 : Number((match[2] ?? "").padEnd(digits, "0") || "0");
  const amount = whole * (10 ** digits) + fraction;
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(amount)) {
    throw new Error("Price exceeds the safe supported range.");
  }
  if (amount < 1) throw new Error("Price must be greater than zero.");
  return amount;
}

function splitList(value: string, maximum: number, field: string): string[] {
  const values = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  if (values.length > maximum) throw new Error(field + " contains more than " + maximum + " values.");
  if (values.some((item) => item.length > 120)) throw new Error("Each " + field + " value must be 120 characters or fewer.");
  return values;
}

function firstDescriptionLine(value: string): string {
  return (value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "").slice(0, 240);
}

export function parseEtsyListingsCsv(source: string): EtsyListingsParseResult {
  let records: CsvRecord[];
  try {
    records = nonBlankRecords(source);
  } catch (error) {
    return { rows: [], errors: [error instanceof Error ? error.message : "Unable to parse Etsy CSV."] };
  }
  if (records.length < 2) {
    return { rows: [], errors: ["The Etsy CSV must include a header and at least one listing row."] };
  }

  const headers = records[0].cells.map((cell) => cell.trim().toUpperCase());
  const duplicateHeaders = headers.filter((name, index) => headers.indexOf(name) !== index);
  const missingHeaders = REQUIRED_HEADERS.filter((name) => !headers.includes(name));
  const headerErrors: string[] = [];
  if (duplicateHeaders.length) headerErrors.push("Duplicate Etsy CSV columns: " + [...new Set(duplicateHeaders)].join(", ") + ".");
  if (missingHeaders.length) headerErrors.push("Missing required Etsy CSV columns: " + missingHeaders.join(", ") + ".");
  if (!headers.some((name) => /^IMAGE(?:[1-9]|10)$/.test(name))) {
    headerErrors.push("The Etsy export must contain at least one IMAGE1–IMAGE10 column.");
  }
  if (headerErrors.length) return { rows: [], errors: headerErrors };

  const dataRecords = records.slice(1);
  if (dataRecords.length > MAX_ROWS) {
    return { rows: [], errors: ["A single Etsy import is limited to " + MAX_ROWS + " listing rows."] };
  }

  const columnIndex = new Map(headers.map((name, index) => [name, index]));
  const rows: EtsyListingImportRow[] = [];
  const globalErrors: string[] = [];

  for (const record of dataRecords) {
    if (record.cells.length !== headers.length) {
      globalErrors.push("Line " + record.line + " has " + record.cells.length + " cells; expected " + headers.length + ".");
      continue;
    }
    const raw = (name: string) => record.cells[columnIndex.get(name) ?? -1] ?? "";
    const value = (name: string) => raw(name).trim();
    const title = value("TITLE");
    const description = raw("DESCRIPTION").trim();
    const currency = value("CURRENCY_CODE").toUpperCase();
    const errors: string[] = [];
    const warnings: string[] = [];
    let priceMinor: number | null = null;
    let quantity = Number.NaN;
    let materials: string[] = [];
    let tags: string[] = [];

    if (title.length < 3 || title.length > 240) errors.push("Title must contain 3–240 characters.");
    if (description.length > 12000) errors.push("Description exceeds 12,000 characters.");
    try {
      priceMinor = toMinorUnits(value("PRICE"), currency);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Invalid listing price.");
    }
    const quantityText = value("QUANTITY");
    quantity = /^(0|[1-9]\d*)$/.test(quantityText) ? Number(quantityText) : Number.NaN;
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 2147483647) {
      errors.push("Quantity must be a whole number between 0 and 2,147,483,647.");
    }

    try {
      tags = splitList(value("TAGS"), 20, "tags");
      materials = splitList(value("MATERIALS"), 40, "materials");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Invalid tags or materials.");
    }

    const sourceSku = value("SKU") || null;
    const normalizedSku = sourceSku?.toUpperCase() ?? null;
    const skuIsValid = !normalizedSku || /^[A-Z0-9][A-Z0-9._/-]{0,99}$/.test(normalizedSku);
    const sku = skuIsValid ? normalizedSku : null;
    if (!skuIsValid) {
      warnings.push("The source SKU contains characters unsupported by the unique catalogue SKU field; its original value is preserved for owner review and no variant SKU was assigned.");
    }

    const sourceImageUrls: string[] = [];
    for (let imageNumber = 1; imageNumber <= 10; imageNumber += 1) {
      const imageUrl = value("IMAGE" + imageNumber);
      if (!imageUrl) continue;
      if (isAllowedEtsyImageUrl(imageUrl)) sourceImageUrls.push(imageUrl);
      else warnings.push("IMAGE" + imageNumber + " was not staged because it is not an approved Etsy static-image URL.");
    }
    if (!sourceImageUrls.length) warnings.push("No approved Etsy source image URL was found for this listing.");

    const variations: Array<{ type: string; name: string; values: string }> = [];
    for (let variationNumber = 1; variationNumber <= 3; variationNumber += 1) {
      const type = value("VARIATION " + variationNumber + " TYPE");
      const name = value("VARIATION " + variationNumber + " NAME");
      const variationValues = value("VARIATION " + variationNumber + " VALUES");
      if (type || name || variationValues) variations.push({ type, name, values: variationValues });
    }
    if (variations.length) {
      warnings.push("Etsy listing options were preserved as source metadata; create and verify purchasable variants in the owner workspace.");
    }

    const fingerprint = [
      title.toLowerCase(),
      sourceSku ?? "",
      value("PRICE"),
      description,
      sourceImageUrls.join("|"),
      record.line.toString(),
    ].join("\n");
    const baseSlug = slugify(title) || "etsy-listing";
    const slug = (baseSlug + "-" + stableHash(fingerprint)).slice(0, 180);
    const shortDescription = firstDescriptionLine(description);

    rows.push({
      line: record.line,
      slug,
      title,
      short_description: shortDescription,
      description,
      category_slug: null,
      price_minor: priceMinor,
      currency,
      compare_at_price_minor: null,
      sku,
      quantity_on_hand: Number.isNaN(quantity) ? 0 : quantity,
      materials,
      sizes: [],
      measurements: {},
      condition_notes: "",
      provenance: "",
      craft_story: "",
      errors,
      tags,
      sourceSku,
      sourceImageUrls,
      warnings,
      sourceMetadata: {
        provider: "etsy",
        sourceRow: record.line,
        sourceSku,
        sourceSkuDuplicate: false,
        imageUrls: sourceImageUrls,
        variations,
      },
    });
  }

  const skuLines = new Map<string, number[]>();
  for (const row of rows) {
    if (row.sku) skuLines.set(row.sku, [...(skuLines.get(row.sku) ?? []), row.line]);
  }
  for (const row of rows) {
    if (!row.sku) continue;
    const duplicateLines = skuLines.get(row.sku) ?? [];
    if (duplicateLines.length > 1) {
      row.sourceMetadata.sourceSkuDuplicate = true;
      row.sku = null;
      row.warnings.push("SKU " + row.sourceSku + " is used by multiple listings; it was preserved as source metadata and not assigned as a unique variant SKU.");
    }
  }

  if (!rows.length && !globalErrors.length) globalErrors.push("No Etsy listing rows were found.");
  return { rows, errors: globalErrors };
}
