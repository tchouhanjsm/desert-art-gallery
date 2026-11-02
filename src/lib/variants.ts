export type VariantAttributes = Record<string, string | number | boolean>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeVariantId(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value.trim())
    ? value.trim().toLowerCase()
    : null;
}

export function parseVariantAttributes(value: unknown): VariantAttributes {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Variant attributes must be a JSON object.");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length < 1 || entries.length > 12) {
    throw new Error("Provide between one and twelve merchant-supplied variant attributes.");
  }
  const result: VariantAttributes = {};
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(key)) {
      throw new Error("Variant attribute names must start with a letter and contain only letters, numbers, underscores or hyphens.");
    }
    if (typeof rawValue === "string") {
      const text = rawValue.trim();
      if (!text || text.length > 120) throw new Error("Variant text values must contain 1–120 characters.");
      result[key] = text;
    } else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      result[key] = rawValue;
    } else if (typeof rawValue === "boolean") {
      result[key] = rawValue;
    } else {
      throw new Error("Variant attributes must use text, numeric or boolean scalar values.");
    }
  }
  return result;
}

export function resolveVariantPriceMinor(
  override: number | null | undefined,
  base: number | null | undefined,
): number | null {
  const value = override == null ? base : override;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function isVariantInStock(variant: { status: string; quantityOnHand: number }): boolean {
  return variant.status === "active"
    && Number.isSafeInteger(variant.quantityOnHand)
    && variant.quantityOnHand > 0;
}
