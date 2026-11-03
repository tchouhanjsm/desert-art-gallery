import { describe, expect, it } from "vitest";
import {
  isValidCustomerEmail,
  normalizeCustomerEmail,
  parseCustomerAddressInput,
  validateCustomerDisplayName,
  validateCustomerPhone,
} from "./customer-account";

describe("customer account input contracts", () => {
  it("normalizes email for case-insensitive account identity", () => {
    expect(normalizeCustomerEmail("  Gallery.Person@Example.COM ")).toBe("gallery.person@example.com");
    expect(isValidCustomerEmail("Gallery.Person@Example.COM")).toBe(true);
    expect(isValidCustomerEmail("not-an-email")).toBe(false);
    expect(isValidCustomerEmail("a".repeat(250) + "@example.com")).toBe(false);
  });

  it("requires a bounded display name and validates optional phone numbers", () => {
    expect(validateCustomerDisplayName("  A Gallery Customer  ")).toBe("A Gallery Customer");
    expect(() => validateCustomerDisplayName(" ")).toThrow();
    expect(() => validateCustomerDisplayName("x")).toThrow();
    expect(validateCustomerPhone("+91 98765 43210")).toBe("+91 98765 43210");
    expect(() => validateCustomerPhone("call me")).toThrow();
  });

  it("normalizes and validates address fields without accepting an invalid country or address ID", () => {
    const address = parseCustomerAddressInput({
      recipientName: "  Customer  ",
      addressLine1: "  12 Main Road ",
      addressLine2: "",
      city: "Jaisalmer",
      region: "Rajasthan",
      postalCode: "345001",
      countryCode: "in",
      phone: "",
      isDefaultShipping: true,
    });
    expect(address.countryCode).toBe("IN");
    expect(address.recipientName).toBe("Customer");
    expect(address.isDefaultShipping).toBe(true);
    expect(() => parseCustomerAddressInput({ ...address, countryCode: "IND" })).toThrow();
    expect(() => parseCustomerAddressInput({ ...address, id: "not-a-uuid" })).toThrow();
  });
});
