import { describe, expect, it } from "vitest";
import { formatProductMeasurements, sortProductImages } from "./product-details";

describe("product detail presentation", () => {
  it("renders only supplied scalar measurements without inventing units", () => {
    expect(formatProductMeasurements({
      chest_width: "42 cm",
      length: 68,
      sleeve: "",
      nested: { value: "not a scalar" },
      notes: ["not", "a", "measurement"],
      unknown: null,
      verified: true,
      zero_value: 0,
    })).toEqual([
      { label: "Chest Width", value: "42 cm" },
      { label: "Length", value: "68" },
      { label: "Zero Value", value: "0" },
    ]);
  });

  it("ignores malformed measurement containers and unsafe values", () => {
    expect(formatProductMeasurements(null)).toEqual([]);
    expect(formatProductMeasurements([])).toEqual([]);
    expect(formatProductMeasurements("42 cm")).toEqual([]);
    expect(formatProductMeasurements({
      "": "value",
      too_long: "x".repeat(161),
      control: "left\u0000right",
    })).toEqual([{ label: "Control", value: "leftright" }]);
  });

  it("sorts primary image first, then merchant order and creation time", () => {
    const images = [
      { id: "late", is_primary: false, sort_order: 2, created_at: "2026-01-03" },
      { id: "primary", is_primary: true, sort_order: 9, created_at: "2026-01-04" },
      { id: "early", is_primary: false, sort_order: 1, created_at: "2026-01-02" },
      { id: "tie-later", is_primary: false, sort_order: 1, created_at: "2026-01-05" },
    ];

    expect(sortProductImages(images).map((image) => image.id)).toEqual([
      "primary", "early", "tie-later", "late",
    ]);
    expect(images[0].id).toBe("late");
  });
});
