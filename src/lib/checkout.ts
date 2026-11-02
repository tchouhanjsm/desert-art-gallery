export type CheckoutAddress = {
  recipient_name: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  region?: string;
  postal_code: string;
  country_code: string;
  phone?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function boundedText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > maximum) return null;
  return trimmed;
}

export function isCheckoutUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function normalizeCheckoutAddress(input: unknown): CheckoutAddress | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const recipient = boundedText(value.recipient_name, 160);
  const line1 = boundedText(value.address_line_1, 240);
  const line2 = boundedText(value.address_line_2 ?? "", 240);
  const city = boundedText(value.city, 120);
  const region = boundedText(value.region ?? "", 120);
  const postal = boundedText(value.postal_code, 24);
  const country = boundedText(value.country_code, 2)?.toUpperCase();
  const phone = boundedText(value.phone ?? "", 40);

  if (!recipient || !line1 || !city || !postal || !country || !/^[A-Z]{2}$/.test(country)
      || line2 === null || region === null || phone === null) return null;

  return {
    recipient_name: recipient,
    address_line_1: line1,
    ...(line2 ? { address_line_2: line2 } : {}),
    city,
    ...(region ? { region } : {}),
    postal_code: postal,
    country_code: country,
    ...(phone ? { phone } : {}),
  };
}

export function parseCurrencyAmountToMinor(value: unknown, currency: string): number | null {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(currency)) return null;
  const input = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(input)) return null;
  let digits: number;
  try {
    const options = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions();
    digits = options.maximumFractionDigits ?? options.minimumFractionDigits ?? 2;
  } catch {
    return null;
  }
  const [whole, fraction = ""] = input.split(".");
  if (fraction.length > digits || (digits === 0 && input.includes("."))) return null;
  try {
    const scale = 10 ** digits;
    const minor = Number(whole) * scale + Number((fraction + "0".repeat(digits)).slice(0, digits) || "0");
    if (!Number.isSafeInteger(minor) || minor < 0) return null;
    return minor;
  } catch {
    return null;
  }
}

export function formatMinorForInput(amountMinor: number, currency: string): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || !/^[A-Z]{3}$/.test(currency)) return "";
  let digits: number;
  try {
    const options = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions();
    digits = options.maximumFractionDigits ?? options.minimumFractionDigits ?? 2;
  } catch {
    return "";
  }
  const scale = 10 ** digits;
  const whole = Math.floor(amountMinor / scale);
  if (digits === 0) return String(whole);
  const fraction = String(amountMinor % scale).padStart(digits, "0");
  return String(whole) + "." + fraction;
}

export function normalizeCountryCodes(value: unknown): string[] | null {
  if (typeof value !== "string") return null;
  const codes = value.split(",").map((code) => code.trim().toUpperCase()).filter(Boolean);
  if (codes.length < 1 || codes.length > 50 || codes.some((code) => !/^[A-Z]{2}$/.test(code))) return null;
  return [...new Set(codes)];
}
