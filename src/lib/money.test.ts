import { describe, expect, it } from "vitest";
import { amountInMajorUnits, formatMoneyFromMinor } from "./money";

describe("money minor-unit conversion", () => {
  it("uses two decimal places for INR and USD", () => {
    expect(amountInMajorUnits(12345, "INR")).toBe(123.45);
    expect(amountInMajorUnits(12345, "USD")).toBe(123.45);
  });

  it("uses zero decimal places for JPY", () => {
    expect(amountInMajorUnits(12345, "JPY")).toBe(12345);
  });

  it("uses three decimal places for KWD", () => {
    expect(amountInMajorUnits(12345, "KWD")).toBe(12.345);
  });

  it("formats the converted amount consistently", () => {
    expect(formatMoneyFromMinor(12345, "JPY")).toContain("12,345");
  });
});
