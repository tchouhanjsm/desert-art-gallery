export const PRODUCT_IMPORT_HEADERS = [
  "slug",
  "title",
  "short_description",
  "description",
  "category_slug",
  "price",
  "currency",
  "compare_at_price",
  "sku",
  "quantity_on_hand",
  "materials",
  "sizes",
  "measurements",
  "condition_notes",
  "provenance",
  "craft_story",
] as const;

export type ProductImportRow = {
  line: number;
  slug: string;
  title: string;
  short_description: string;
  description: string;
  category_slug: string | null;
  price_minor: number | null;
  currency: string;
  compare_at_price_minor: number | null;
  sku: string | null;
  quantity_on_hand: number;
  materials: string[];
  sizes: string[];
  measurements: Record<string, unknown>;
  condition_notes: string;
  provenance: string;
  craft_story: string;
  errors: string[];
};

export type ProductImportPreviewRow = Pick<
  ProductImportRow,
  "line" | "slug" | "title" | "sku" | "category_slug" | "price_minor" | "currency" | "quantity_on_hand" | "errors"
>;

export type ProductImportParseResult = {
  rows: ProductImportRow[];
  errors: string[];
};

type CsvRecord = { cells: string[]; line: number };

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

function slugify(value: string): string {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function currencyFractionDigits(currency: string): number {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO currency code.");
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    throw new Error("Currency is not supported: " + currency + ".");
  }
}

function parseMinorUnits(raw: string, currency: string): number | null {
  if (!raw) return null;
  const digits = currencyFractionDigits(currency);
  const pattern = digits === 0
    ? /^(0|[1-9]\d*)$/
    : new RegExp("^(0|[1-9]\\d*)(?:\\.(\\d{1," + digits + "}))?$");
  const match = raw.match(pattern);
  if (!match) {
    throw new Error("Enter a plain decimal amount with no more than " + digits + " fractional digits for " + currency + ".");
  }
  const whole = Number(match[1]);
  const fraction = digits === 0 ? 0 : Number((match[2] ?? "").padEnd(digits, "0") || "0");
  const minor = whole * (10 ** digits) + fraction;
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(minor)) {
    throw new Error("Amount exceeds the safe supported range.");
  }
  return minor;
}

function parsePipeList(raw: string, field: string): string[] {
  if (!raw) return [];
  const values = raw.split("|").map((item) => item.trim()).filter(Boolean);
  if (values.length > 40) throw new Error(field + " may contain at most 40 values separated by |.");
  if (values.some((item) => item.length > 120)) throw new Error("Each " + field + " value must be 120 characters or fewer.");
  return [...new Set(values)];
}

function parseMeasurements(raw: string): Record<string, unknown> {
  if (!raw) return {};
  if (raw.length > 5000) throw new Error("Measurements JSON must be 5,000 characters or fewer.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Measurements must be valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Measurements must be a JSON object, not an array or scalar.");
  }
  return parsed as Record<string, unknown>;
}

export function parseProductCsv(source: string): ProductImportParseResult {
  const normalized = source.replace(/^\uFEFF/, "");
  let records: CsvRecord[];
  try {
    records = readCsvRecords(normalized);
  } catch (error) {
    return { rows: [], errors: [error instanceof Error ? error.message : "Unable to parse the CSV file."] };
  }

  const nonBlankRecords = records.filter((record) => record.cells.some((cell) => cell.trim() !== ""));
  if (nonBlankRecords.length < 2) return { rows: [], errors: ["The CSV must include a header and at least one product row."] };

  const header = nonBlankRecords[0].cells.map((cell) => cell.trim());
  const duplicateHeaders = header.filter((name, index) => header.indexOf(name) !== index);
  const unknownHeaders = header.filter((name) => !(PRODUCT_IMPORT_HEADERS as readonly string[]).includes(name));
  const missingHeaders = PRODUCT_IMPORT_HEADERS.filter((name) => !header.includes(name));
  const headerErrors: string[] = [];
  if (duplicateHeaders.length) headerErrors.push("Duplicate CSV columns: " + [...new Set(duplicateHeaders)].join(", ") + ".");
  if (unknownHeaders.length) headerErrors.push("Unknown CSV columns: " + unknownHeaders.join(", ") + ".");
  if (missingHeaders.length) headerErrors.push("Missing required CSV columns: " + missingHeaders.join(", ") + ".");
  if (headerErrors.length) return { rows: [], errors: headerErrors };

  const columnIndex = new Map(header.map((name, index) => [name, index]));
  const dataRecords = nonBlankRecords.slice(1);
  if (dataRecords.length > 500) {
    return { rows: [], errors: ["A single import is limited to 500 product rows. Split the file and preview each batch separately."] };
  }

  const rows: ProductImportRow[] = [];
  const globalErrors: string[] = [];

  for (const record of dataRecords) {
    if (record.cells.length !== header.length) {
      globalErrors.push("Line " + record.line + " has " + record.cells.length + " cells; expected " + header.length + ".");
      continue;
    }

    const get = (name: (typeof PRODUCT_IMPORT_HEADERS)[number]) => record.cells[columnIndex.get(name) ?? -1]?.trim() ?? "";
    const title = get("title");
    const currency = get("currency").toUpperCase();
    const errors: string[] = [];
    let priceMinor: number | null = null;
    let compareMinor: number | null = null;
    let materials: string[] = [];
    let sizes: string[] = [];
    let measurements: Record<string, unknown> = {};

    if (title.length < 3 || title.length > 180) errors.push("Title must contain 3–180 characters.");
    if (get("short_description").length > 240) errors.push("Short description exceeds 240 characters.");
    if (get("description").length > 12000) errors.push("Description exceeds 12,000 characters.");
    if (get("condition_notes").length > 4000) errors.push("Condition notes exceed 4,000 characters.");
    if (get("provenance").length > 4000) errors.push("Provenance exceeds 4,000 characters.");
    if (get("craft_story").length > 5000) errors.push("Craft story exceeds 5,000 characters.");

    try {
      currencyFractionDigits(currency);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Invalid currency.");
    }

    if (currencyFractionDigitsSafe(currency) !== null) {
      try {
        priceMinor = parseMinorUnits(get("price"), currency);
        compareMinor = parseMinorUnits(get("compare_at_price"), currency);
        if (compareMinor !== null && priceMinor === null) errors.push("A compare-at price requires a verified selling price.");
        if (compareMinor !== null && priceMinor !== null && compareMinor < priceMinor) errors.push("Compare-at price cannot be lower than the selling price.");
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Invalid price.");
      }
    }

    const quantityText = get("quantity_on_hand");
    const quantity = /^(0|[1-9]\d*)$/.test(quantityText) ? Number(quantityText) : Number.NaN;
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 2147483647) {
      errors.push("Stock quantity must be a whole number between 0 and 2,147,483,647.");
    }

    const rawSlug = get("slug");
    const slug = slugify(rawSlug || title);
    if (!slug || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push("A valid URL slug could not be generated.");
    const categorySlug = get("category_slug") ? slugify(get("category_slug")) : null;
    if (categorySlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categorySlug)) errors.push("Category must be an existing category slug.");

    const skuText = get("sku").toUpperCase();
    const sku = skuText || null;
    if (sku && !/^[A-Z0-9][A-Z0-9._/-]{0,79}$/.test(sku)) errors.push("SKU may contain letters, numbers, dot, underscore, slash or hyphen (max 80 characters).");

    try {
      materials = parsePipeList(get("materials"), "materials");
      sizes = parsePipeList(get("sizes"), "sizes");
      measurements = parseMeasurements(get("measurements"));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Invalid list or measurements value.");
    }

    rows.push({
      line: record.line,
      slug,
      title,
      short_description: get("short_description"),
      description: get("description"),
      category_slug: categorySlug,
      price_minor: priceMinor,
      currency,
      compare_at_price_minor: compareMinor,
      sku,
      quantity_on_hand: Number.isNaN(quantity) ? 0 : quantity,
      materials,
      sizes,
      measurements,
      condition_notes: get("condition_notes"),
      provenance: get("provenance"),
      craft_story: get("craft_story"),
      errors,
    });
  }

  const slugLines = new Map<string, number[]>();
  const skuLines = new Map<string, number[]>();
  for (const row of rows) {
    slugLines.set(row.slug, [...(slugLines.get(row.slug) ?? []), row.line]);
    if (row.sku) skuLines.set(row.sku, [...(skuLines.get(row.sku) ?? []), row.line]);
  }
  for (const row of rows) {
    const duplicateSlug = slugLines.get(row.slug) ?? [];
    if (duplicateSlug.length > 1) row.errors.push("Duplicate slug in this file (lines " + duplicateSlug.join(", ") + ").");
    if (row.sku) {
      const duplicateSku = skuLines.get(row.sku) ?? [];
      if (duplicateSku.length > 1) row.errors.push("Duplicate SKU in this file (lines " + duplicateSku.join(", ") + ").");
    }
  }

  if (!rows.length && !globalErrors.length) globalErrors.push("No product rows were found.");
  return { rows, errors: globalErrors };
}

function currencyFractionDigitsSafe(currency: string): number | null {
  try {
    return currencyFractionDigits(currency);
  } catch {
    return null;
  }
}
