import { normalizeVariantId } from "./variants";

export type CartLine = { slug: string; quantity: number; variantId?: string };

export function cartLineKey(slug: string, variantId?: string): string {
  return slug + "::" + (variantId ?? "");
}

export function normalizeCartLines(input: unknown): CartLine[] {
  if (!Array.isArray(input)) return [];
  const quantities = new Map<string, CartLine>();
  for (const entry of input.slice(0, 100)) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as { slug?: unknown; quantity?: unknown; variantId?: unknown };
    if (typeof candidate.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.slug)) continue;
    const quantity = Number(candidate.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) continue;
    const variantId = candidate.variantId == null ? undefined : normalizeVariantId(candidate.variantId) ?? undefined;
    if (candidate.variantId != null && !variantId) continue;
    const key = cartLineKey(candidate.slug, variantId);
    if (!quantities.has(key) && quantities.size >= 30) continue;
    const current = quantities.get(key);
    quantities.set(key, {
      slug: candidate.slug,
      ...(variantId ? { variantId } : {}),
      quantity: Math.min(99, (current?.quantity ?? 0) + quantity),
    });
  }
  return Array.from(quantities.values());
}

export function mergeCartLine(
  lines: CartLine[],
  slug: string,
  quantity: number,
  maximum = 99,
  variantId?: string,
): CartLine[] {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Number.isInteger(quantity) || quantity < 1) return lines;
  const normalizedVariantId = variantId === undefined ? undefined : normalizeVariantId(variantId) ?? undefined;
  if (variantId !== undefined && !normalizedVariantId) return lines;
  const key = cartLineKey(slug, normalizedVariantId);
  const existing = lines.find((line) => cartLineKey(line.slug, line.variantId) === key);
  if (!existing && lines.length >= 30) return lines;
  const next = existing
    ? lines.map((line) => cartLineKey(line.slug, line.variantId) === key
      ? { ...line, quantity: Math.min(maximum, line.quantity + quantity) }
      : line)
    : [...lines, { slug, ...(normalizedVariantId ? { variantId: normalizedVariantId } : {}), quantity: Math.min(maximum, quantity) }];
  return normalizeCartLines(next);
}

export function setCartLineQuantity(lines: CartLine[], slug: string, quantity: number, variantId?: string): CartLine[] {
  const key = cartLineKey(slug, variantId);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return lines.filter((line) => cartLineKey(line.slug, line.variantId) !== key);
  }
  return normalizeCartLines(lines.map((line) => cartLineKey(line.slug, line.variantId) === key
    ? { ...line, quantity: Math.min(99, quantity) }
    : line));
}

export function combineCartLines(saved: CartLine[], guest: CartLine[], mergeSaved: boolean): CartLine[] {
  return normalizeCartLines(mergeSaved ? [...saved, ...guest] : guest);
}

export function shouldMergeSavedCart(syncedUserId: unknown, currentUserId: string): boolean {
  return typeof syncedUserId !== "string" || syncedUserId !== currentUserId;
}
