export type CartLine = { slug: string; quantity: number };

export function normalizeCartLines(input: unknown): CartLine[] {
  if (!Array.isArray(input)) return [];
  const quantities = new Map<string, number>();
  for (const entry of input.slice(0, 100)) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as { slug?: unknown; quantity?: unknown };
    if (typeof candidate.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.slug)) continue;
    const quantity = Number(candidate.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) continue;
    if (!quantities.has(candidate.slug) && quantities.size >= 30) continue;
    quantities.set(candidate.slug, Math.min(99, (quantities.get(candidate.slug) ?? 0) + quantity));
  }
  return Array.from(quantities, ([slug, quantity]) => ({ slug, quantity }));
}

export function mergeCartLine(lines: CartLine[], slug: string, quantity: number, maximum = 99): CartLine[] {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Number.isInteger(quantity) || quantity < 1) return lines;
  const existing = lines.find((line) => line.slug === slug);
  if (!existing && lines.length >= 30) return lines;
  const next = existing
    ? lines.map((line) => line.slug === slug ? { ...line, quantity: Math.min(maximum, line.quantity + quantity) } : line)
    : [...lines, { slug, quantity: Math.min(maximum, quantity) }];
  return normalizeCartLines(next);
}

export function setCartLineQuantity(lines: CartLine[], slug: string, quantity: number): CartLine[] {
  if (!Number.isInteger(quantity) || quantity <= 0) return lines.filter((line) => line.slug !== slug);
  return normalizeCartLines(lines.map((line) => line.slug === slug ? { ...line, quantity: Math.min(99, quantity) } : line));
}
