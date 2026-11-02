import { describe, expect, it } from "vitest";
import {
  formatMinorForInput,
  isCheckoutUuid,
  normalizeCheckoutAddress,
  normalizeCountryCodes,
  parseCurrencyAmountToMinor,
} from "./checkout";

describe("checkout input validation", () => {
  it("normalizes and bounds delivery address fields", () => {
    expect(normalizeCheckoutAddress({
      recipient_name: "  Gallery Customer ",
      address_line_1: "  12 Market Road ",
      city: " Jaipur ",
      postal_code: " 302001 ",
      country_code: "in",
      phone: " +91 1234567890 ",
    })).toEqual({
      recipient_name: "Gallery Customer",
      address_line_1: "12 Market Road",
      city: "Jaipur",
      postal_code: "302001",
      country_code: "IN",
      phone: "+91 1234567890",
    });
  });

  it("rejects missing required fields, invalid country codes and oversized values", () => {
    expect(normalizeCheckoutAddress({ recipient_name: "A", address_line_1: "B", city: "C", postal_code: "D", country_code: "IND" })).toBeNull();
    expect(normalizeCheckoutAddress({ recipient_name: "A".repeat(161), address_line_1: "B", city: "C", postal_code: "D", country_code: "IN" })).toBeNull();
    expect(normalizeCheckoutAddress({ recipient_name: "A", address_line_1: "B", city: "C", country_code: "IN" })).toBeNull();
  });

  it("accepts only UUID idempotency and resource identifiers", () => {
    expect(isCheckoutUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isCheckoutUuid("not-a-uuid")).toBe(false);
  });

  it("parses currency-specific minor units without floating-point rounding", () => {
    expect(parseCurrencyAmountToMinor("125.40", "USD")).toBe(12540);
    expect(parseCurrencyAmountToMinor("125", "JPY")).toBe(125);
    expect(parseCurrencyAmountToMinor("1.234", "KWD")).toBe(1234);
    expect(parseCurrencyAmountToMinor("1.234", "USD")).toBeNull();
    expect(parseCurrencyAmountToMinor("1.5", "JPY")).toBeNull();
    expect(parseCurrencyAmountToMinor("-1.00", "USD")).toBeNull();
    expect(parseCurrencyAmountToMinor("1e3", "USD")).toBeNull();
  });

  it("formats stored minor units for editable decimal inputs", () => {
    expect(formatMinorForInput(12540, "USD")).toBe("125.40");
    expect(formatMinorForInput(125, "JPY")).toBe("125");
    expect(formatMinorForInput(1234, "KWD")).toBe("1.234");
  });

  it("normalizes country lists and rejects invalid entries", () => {
    expect(normalizeCountryCodes("in, US, in")).toEqual(["IN", "US"]);
    expect(normalizeCountryCodes("IN, USA")).toBeNull();
    expect(normalizeCountryCodes("")).toBeNull();
  });
});
