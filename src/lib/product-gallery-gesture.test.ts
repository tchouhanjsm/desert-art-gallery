import { describe, expect, it } from "vitest";
import { resolveProductGallerySwipe } from "./product-gallery-gesture";

describe("product gallery touch gestures", () => {
  it("moves to the next image on a deliberate left swipe", () => {
    expect(resolveProductGallerySwipe({ x: 220, y: 120 }, { x: 150, y: 126 })).toBe("next");
  });

  it("moves to the previous image on a deliberate right swipe", () => {
    expect(resolveProductGallerySwipe({ x: 140, y: 120 }, { x: 214, y: 126 })).toBe("previous");
  });

  it("ignores a movement below the minimum swipe distance", () => {
    expect(resolveProductGallerySwipe({ x: 180, y: 120 }, { x: 145, y: 122 })).toBeNull();
  });

  it("does not turn vertical page scrolling into gallery navigation", () => {
    expect(resolveProductGallerySwipe({ x: 180, y: 120 }, { x: 205, y: 190 })).toBeNull();
  });

  it("ignores diagonal movement that is not clearly horizontal", () => {
    expect(resolveProductGallerySwipe({ x: 180, y: 120 }, { x: 245, y: 180 })).toBeNull();
  });

  it("uses the horizontal direction even when a small vertical drift is present", () => {
    expect(resolveProductGallerySwipe({ x: 180, y: 120 }, { x: 115, y: 155 })).toBe("next");
  });
});
