import { describe, expect, it } from "vitest";
import { formatMoneyFromMinor } from "./money";

describe("formatMoneyFromMinor", () => {
  it("formats two-decimal currencies from minor units", () => {
    expect(formatMoneyFromMinor(1299, "USD")).toContain("12.99");
    expect(formatMoneyFromMinor(1299, "GBP")).toContain("12.99");
  });

  it("respects currencies without fractional minor units", () => {
    expect(formatMoneyFromMinor(1299, "JPY")).toContain("1,299");
  });

  it("respects currencies with three fractional minor units", () => {
    expect(formatMoneyFromMinor(1299, "KWD")).toContain("1.299");
  });

  it("does not throw for a malformed currency code", () => {
    expect(formatMoneyFromMinor(1299, "invalid")).toContain("12.99");
  });
});
