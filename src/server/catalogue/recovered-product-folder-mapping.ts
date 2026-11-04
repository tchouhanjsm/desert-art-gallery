import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const MAX_PRODUCT_IMAGE_BYTES = 12 * 1024 * 1024;

export const DEFAULT_RECOVERED_PRODUCT_ROOT = path.resolve(
  process.cwd(),
  "public",
  "images",
  "products",
);

export type RecoveredProductFolderAudit = {
  folderName: string;
  imageCount: number;
  imageBytes: number;
  oversizedImages: string[];
  unsupportedFiles: string[];
  nestedDirectories: string[];
  ignoredHiddenFiles: number;
  errors: string[];
};

export type RecoveredProductFolderInventory = {
  root: string;
  productFolders: RecoveredProductFolderAudit[];
  totalImages: number;
  totalImageBytes: number;
  unsupportedFileCount: number;
  oversizedImageCount: number;
  nestedDirectoryCount: number;
  ignoredHiddenFileCount: number;
  errors: string[];
};

export type RecoveredProductRecord = {
  id: string;
  title: string;
  slug: string;
  status: string;
  sourceMetadata: Record<string, unknown> | null;
};

export type RecoveredProductMappingStatus =
  | "unique_etsy_draft_candidate"
  | "non_draft_etsy_product"
  | "non_etsy_title_candidate"
  | "ambiguous_product_title"
  | "duplicate_recovered_title"
  | "unmatched";

export type RecoveredProductMappingRow = {
  folderName: string;
  normalizedTitle: string;
  imageCount: number;
  imageBytes: number;
  status: RecoveredProductMappingStatus;
  manualReviewRequired: true;
  candidateProducts: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    sourceProvider: string | null;
  }>;
  suggestedProducts: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    sourceProvider: string | null;
    similarityScore: number;
  }>;
};

export type RecoveredProductMappingReport = {
  summary: {
    productFolders: number;
    totalImages: number;
    totalImageBytes: number;
    uniqueEtsyDraftCandidates: number;
    nonDraftEtsyProducts: number;
    nonEtsyTitleCandidates: number;
    ambiguousProductTitles: number;
    duplicateRecoveredTitles: number;
    unmatchedFolders: number;
    unmatchedFoldersWithSuggestions: number;
    suggestedProductCandidates: number;
  };
  inventory: RecoveredProductFolderInventory;
  mappings: RecoveredProductMappingRow[];
};

export function normalizeRecoveredProductTitle(value: string): string {
  return value.normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/_/g, " ")
    .replace(/[\s\u00A0]+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}


const MAX_TITLE_SUGGESTIONS = 3;
const MIN_TITLE_SUGGESTION_SCORE = 0.32;

type IndexedTitleProduct = {
  product: RecoveredProductRecord;
  tokens: Set<string>;
  bigrams: Set<string>;
};

type RecoveredTitleSuggestionIndex = {
  products: IndexedTitleProduct[];
  inverseDocumentFrequency: Map<string, number>;
};

function titleTokens(value: string): Set<string> {
  return new Set(normalizeRecoveredProductTitle(value).match(/[\p{L}\p{N}]+/gu) ?? []);
}

function titleBigrams(value: string): Set<string> {
  const compact = normalizeRecoveredProductTitle(value).replace(/[^\p{L}\p{N}]/gu, "");
  const bigrams = new Set<string>();
  for (let index = 0; index < compact.length - 1; index += 1) {
    bigrams.add(compact.slice(index, index + 2));
  }
  return bigrams;
}

function buildRecoveredTitleSuggestionIndex(
  products: RecoveredProductRecord[],
): RecoveredTitleSuggestionIndex {
  const indexedProducts = products.map((product) => ({
    product,
    tokens: titleTokens(product.title),
    bigrams: titleBigrams(product.title),
  })).filter((entry) => entry.tokens.size > 0);
  const documentFrequency = new Map<string, number>();

  for (const entry of indexedProducts) {
    for (const token of entry.tokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const inverseDocumentFrequency = new Map(
    [...documentFrequency].map(([token, frequency]) => [
      token,
      Math.log(1 + indexedProducts.length / (1 + frequency)) + 1,
    ]),
  );

  return { products: indexedProducts, inverseDocumentFrequency };
}

function rankRecoveredTitleSuggestions(
  folderTitle: string,
  exactCandidates: RecoveredProductRecord[],
  index: RecoveredTitleSuggestionIndex,
): RecoveredProductMappingRow["suggestedProducts"] {
  if (exactCandidates.length > 0) return [];

  const folderTokens = titleTokens(folderTitle);
  if (folderTokens.size < 2) return [];
  const folderBigrams = titleBigrams(folderTitle);
  const scored: Array<{ entry: IndexedTitleProduct; score: number }> = [];

  for (const entry of index.products) {
    let sharedTokenCount = 0;
    let sharedWeight = 0;
    let unionWeight = 0;

    for (const token of folderTokens) {
      const weight = index.inverseDocumentFrequency.get(token) ?? 1;
      unionWeight += weight;
      if (entry.tokens.has(token)) {
        sharedTokenCount += 1;
        sharedWeight += weight;
      }
    }
    for (const token of entry.tokens) {
      if (!folderTokens.has(token)) {
        unionWeight += index.inverseDocumentFrequency.get(token) ?? 1;
      }
    }
    if (sharedTokenCount < 2 || unionWeight === 0) continue;

    let sharedBigramCount = 0;
    for (const bigram of folderBigrams) {
      if (entry.bigrams.has(bigram)) sharedBigramCount += 1;
    }
    const bigramDenominator = folderBigrams.size + entry.bigrams.size;
    const bigramScore = bigramDenominator > 0
      ? (2 * sharedBigramCount) / bigramDenominator
      : 0;
    const weightedTokenScore = sharedWeight / unionWeight;
    const score = (weightedTokenScore * 0.85) + (bigramScore * 0.15);

    if (score >= MIN_TITLE_SUGGESTION_SCORE) scored.push({ entry, score });
  }

  return scored
    .sort((left, right) => (
      right.score - left.score
      || left.entry.product.title.localeCompare(right.entry.product.title, "en-US")
      || left.entry.product.slug.localeCompare(right.entry.product.slug, "en-US")
    ))
    .slice(0, MAX_TITLE_SUGGESTIONS)
    .map(({ entry, score }) => ({
      id: entry.product.id,
      title: entry.product.title,
      slug: entry.product.slug,
      status: entry.product.status,
      sourceProvider: typeof entry.product.sourceMetadata?.provider === "string"
        ? entry.product.sourceMetadata.provider
        : null,
      similarityScore: Math.round(score * 1000) / 1000,
    }));
}

export async function scanRecoveredProductFolders(
  root = DEFAULT_RECOVERED_PRODUCT_ROOT,
): Promise<RecoveredProductFolderInventory> {
  const absoluteRoot = path.resolve(root);
  const rootStats = await lstat(absoluteRoot);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error("Recovered product root must be a real directory, not a symbolic link.");
  }

  const rootEntries = await readdir(absoluteRoot, { withFileTypes: true });
  const productFolders: RecoveredProductFolderAudit[] = [];
  const errors: string[] = [];
  let ignoredHiddenFileCount = 0;

  for (const entry of rootEntries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name.startsWith(".") || entry.name.startsWith("._")) {
      ignoredHiddenFileCount += 1;
      continue;
    }
    if (entry.isSymbolicLink()) {
      errors.push(entry.name + ": symbolic links are not accepted in the recovered photo collection.");
      continue;
    }
    if (!entry.isDirectory()) {
      errors.push(entry.name + ": unexpected root-level file; photographs must be inside product folders.");
      continue;
    }

    const folderPath = path.join(absoluteRoot, entry.name);
    const folder: RecoveredProductFolderAudit = {
      folderName: entry.name,
      imageCount: 0,
      imageBytes: 0,
      oversizedImages: [],
      unsupportedFiles: [],
      nestedDirectories: [],
      ignoredHiddenFiles: 0,
      errors: [],
    };
    const children = await readdir(folderPath, { withFileTypes: true });

    for (const child of children) {
      if (child.name.startsWith(".") || child.name.startsWith("._")) {
        folder.ignoredHiddenFiles += 1;
        ignoredHiddenFileCount += 1;
        continue;
      }
      if (child.isSymbolicLink()) {
        folder.errors.push(child.name + ": symbolic links are not accepted.");
        continue;
      }
      if (child.isDirectory()) {
        folder.nestedDirectories.push(child.name);
        continue;
      }
      if (!child.isFile()) {
        folder.errors.push(child.name + ": unsupported filesystem entry.");
        continue;
      }

      const extension = path.extname(child.name).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(extension)) {
        folder.unsupportedFiles.push(child.name);
        continue;
      }

      const filePath = path.join(folderPath, child.name);
      const stats = await lstat(filePath);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        folder.errors.push(child.name + ": image must be a regular file.");
        continue;
      }
      folder.imageCount += 1;
      folder.imageBytes += stats.size;
      if (stats.size < 1) {
        folder.errors.push(child.name + ": image file is empty.");
      } else if (stats.size > MAX_PRODUCT_IMAGE_BYTES) {
        folder.oversizedImages.push(child.name);
      }
    }
    productFolders.push(folder);
  }

  const totalImages = productFolders.reduce((total, folder) => total + folder.imageCount, 0);
  const totalImageBytes = productFolders.reduce((total, folder) => total + folder.imageBytes, 0);
  return {
    root: absoluteRoot,
    productFolders,
    totalImages,
    totalImageBytes,
    unsupportedFileCount: productFolders.reduce((total, folder) => total + folder.unsupportedFiles.length, 0),
    oversizedImageCount: productFolders.reduce((total, folder) => total + folder.oversizedImages.length, 0),
    nestedDirectoryCount: productFolders.reduce((total, folder) => total + folder.nestedDirectories.length, 0),
    ignoredHiddenFileCount,
    errors: [
      ...errors,
      ...productFolders.flatMap((folder) => folder.errors.map((error) => folder.folderName + "/" + error)),
    ],
  };
}

export function buildRecoveredProductMapping(
  inventory: RecoveredProductFolderInventory,
  products: RecoveredProductRecord[],
): RecoveredProductMappingReport {
  const productsByTitle = new Map<string, RecoveredProductRecord[]>();
  for (const product of products) {
    const key = normalizeRecoveredProductTitle(product.title);
    if (!key) continue;
    productsByTitle.set(key, [...(productsByTitle.get(key) ?? []), product]);
  }

  const folderTitleCounts = new Map<string, number>();
  for (const folder of inventory.productFolders) {
    const key = normalizeRecoveredProductTitle(folder.folderName);
    folderTitleCounts.set(key, (folderTitleCounts.get(key) ?? 0) + 1);
  }

  const titleSuggestionIndex = buildRecoveredTitleSuggestionIndex(products);
  const mappings: RecoveredProductMappingRow[] = inventory.productFolders.map((folder) => {
    const normalizedTitle = normalizeRecoveredProductTitle(folder.folderName);
    const candidates = productsByTitle.get(normalizedTitle) ?? [];
    const suggestedProducts = rankRecoveredTitleSuggestions(folder.folderName, candidates, titleSuggestionIndex);
    const duplicateFolderTitle = (folderTitleCounts.get(normalizedTitle) ?? 0) > 1;
    let status: RecoveredProductMappingStatus = "unmatched";

    if (duplicateFolderTitle) {
      status = "duplicate_recovered_title";
    } else if (candidates.length > 1) {
      status = "ambiguous_product_title";
    } else if (candidates.length === 1) {
      const provider = candidates[0].sourceMetadata?.provider;
      if (provider !== "etsy") {
        status = "non_etsy_title_candidate";
      } else if (candidates[0].status !== "draft") {
        status = "non_draft_etsy_product";
      } else {
        status = "unique_etsy_draft_candidate";
      }
    }

    return {
      folderName: folder.folderName,
      normalizedTitle,
      imageCount: folder.imageCount,
      imageBytes: folder.imageBytes,
      status,
      manualReviewRequired: true,
      candidateProducts: candidates.map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        slug: candidate.slug,
        status: candidate.status,
        sourceProvider: typeof candidate.sourceMetadata?.provider === "string"
          ? candidate.sourceMetadata.provider
          : null,
      })),
      suggestedProducts,
    };
  });

  const count = (status: RecoveredProductMappingStatus) => mappings.filter((row) => row.status === status).length;
  return {
    summary: {
      productFolders: inventory.productFolders.length,
      totalImages: inventory.totalImages,
      totalImageBytes: inventory.totalImageBytes,
      uniqueEtsyDraftCandidates: count("unique_etsy_draft_candidate"),
      nonDraftEtsyProducts: count("non_draft_etsy_product"),
      nonEtsyTitleCandidates: count("non_etsy_title_candidate"),
      ambiguousProductTitles: count("ambiguous_product_title"),
      duplicateRecoveredTitles: count("duplicate_recovered_title"),
      unmatchedFolders: count("unmatched"),
      unmatchedFoldersWithSuggestions: mappings.filter((row) => row.status === "unmatched" && row.suggestedProducts.length > 0).length,
      suggestedProductCandidates: mappings.reduce((total, row) => total + row.suggestedProducts.length, 0),
    },
    inventory,
    mappings,
  };
}

export function recoveredProductMappingCsv(report: RecoveredProductMappingReport): string {
  const columns = [
    "recovered_folder",
    "normalized_title",
    "mapping_status",
    "image_count",
    "image_bytes",
    "candidate_product_ids",
    "candidate_product_slugs",
    "candidate_product_titles",
    "suggested_product_ids",
    "suggested_product_slugs",
    "suggested_product_titles",
    "suggested_product_scores",
    "manual_review_required",
    "owner_decision",
    "approved_product_id",
    "approved_product_slug",
    "primary_image_filename",
    "owner_note",
  ];
  const safe = (value: string) => /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
  const cell = (value: string | number | boolean) => {
    const text = safe(String(value));
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const rows = report.mappings.map((row) => [
    row.folderName,
    row.normalizedTitle,
    row.status,
    row.imageCount,
    row.imageBytes,
    row.candidateProducts.map((product) => product.id).join(";"),
    row.candidateProducts.map((product) => product.slug).join(";"),
    row.candidateProducts.map((product) => product.title).join(";"),
    row.suggestedProducts.map((product) => product.id).join(";"),
    row.suggestedProducts.map((product) => product.slug).join(";"),
    row.suggestedProducts.map((product) => product.title).join(";"),
    row.suggestedProducts.map((product) => product.similarityScore.toFixed(3)).join(";"),
    row.manualReviewRequired,
    "NOT_REVIEWED",
    "",
    "",
    "",
    "",
  ]);
  return [columns, ...rows].map((row) => row.map((value) => cell(value)).join(",")).join("\n") + "\n";
}
