export type CustomerAddressInput = {
  id?: string;
  recipientName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  phone: string;
  isDefaultShipping: boolean;
};

function cleanText(value: unknown, field: string, maximum: number, required = false): string {
  if (typeof value !== "string") throw new Error("Enter a valid " + field + ".");
  const cleaned = value.trim();
  if (cleaned.length > maximum || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(cleaned)) {
    throw new Error(field + " is invalid or too long.");
  }
  if (required && !cleaned) throw new Error("Enter " + field + ".");
  return cleaned;
}

export function normalizeCustomerEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidCustomerEmail(value: string): boolean {
  const email = normalizeCustomerEmail(value);
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateCustomerDisplayName(value: unknown): string {
  const name = cleanText(value, "your name", 160, true);
  if (name.length < 2) throw new Error("Your name must contain at least two characters.");
  return name;
}

export function validateCustomerPhone(value: unknown): string {
  const phone = cleanText(value, "phone number", 40);
  if (phone && !/^[0-9+().\-\s]+$/.test(phone)) throw new Error("Enter a valid phone number.");
  return phone;
}

export function parseCustomerAddressInput(input: unknown): CustomerAddressInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Enter a valid delivery address.");
  }
  const row = input as Record<string, unknown>;
  const id = row.id == null || row.id === "" ? undefined : cleanText(row.id, "address ID", 36);
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("The selected address is invalid.");
  }
  const countryCode = cleanText(row.countryCode, "country code", 2, true).toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("Enter a two-letter ISO country code.");
  if (typeof row.isDefaultShipping !== "boolean") throw new Error("Choose whether this is your default delivery address.");
  return {
    ...(id ? { id } : {}),
    recipientName: cleanText(row.recipientName, "recipient name", 160, true),
    addressLine1: cleanText(row.addressLine1, "address line 1", 240, true),
    addressLine2: cleanText(row.addressLine2 ?? "", "address line 2", 240),
    city: cleanText(row.city, "city", 120, true),
    region: cleanText(row.region ?? "", "state or region", 120),
    postalCode: cleanText(row.postalCode, "postal code", 24, true),
    countryCode,
    phone: validateCustomerPhone(row.phone ?? ""),
    isDefaultShipping: row.isDefaultShipping,
  };
}
