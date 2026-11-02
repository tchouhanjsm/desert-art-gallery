export type ProductMeasurement = {
  label: string;
  value: string;
};

type SortableProductImage = {
  is_primary?: boolean | null;
  sort_order?: number | null;
  created_at?: string | null;
};

export function sortProductImages<T extends SortableProductImage>(images: T[]): T[] {
  return [...images].sort((left, right) => {
    const primaryDifference = Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary));
    if (primaryDifference !== 0) return primaryDifference;

    const orderDifference = (left.sort_order ?? 0) - (right.sort_order ?? 0);
    if (orderDifference !== 0) return orderDifference;

    return (left.created_at ?? "").localeCompare(right.created_at ?? "");
  });
}

/**
 * Measurements are merchant-supplied values. Only scalar strings and finite
 * numbers are rendered; units are never inferred or appended by the UI.
 */
export function formatProductMeasurements(input: unknown): ProductMeasurement[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];

  return Object.entries(input as Record<string, unknown>).flatMap(([rawLabel, rawValue]) => {
    const label = rawLabel
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .replace(/\b[a-z]/g, (character) => character.toUpperCase())
      .slice(0, 80);

    let value = "";
    if (typeof rawValue === "string") {
      value = rawValue.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    } else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      value = String(rawValue);
    }

    if (!label || !value || value.length > 160) return [];
    return [{ label, value }];
  });
}


export type PresentableProductImage = {
  storage_path?: string | null;
  alt_text?: string | null;
  rights_confirmed?: boolean | null;
};

export function isPresentableProductImage(image: PresentableProductImage): boolean {
  return image.rights_confirmed === true
    && Boolean(image.storage_path?.trim())
    && Boolean(image.alt_text?.trim());
}
