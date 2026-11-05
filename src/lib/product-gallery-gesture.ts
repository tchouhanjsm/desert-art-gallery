export type ProductGallerySwipePoint = { x: number; y: number };
export type ProductGallerySwipeDirection = "next" | "previous";

const MINIMUM_SWIPE_DISTANCE = 48;
const HORIZONTAL_DOMINANCE_RATIO = 1.2;

/**
 * Resolve a deliberate horizontal swipe without mistaking normal vertical
 * page scrolling or small touch movements for gallery navigation.
 */
export function resolveProductGallerySwipe(
  start: ProductGallerySwipePoint,
  end: ProductGallerySwipePoint,
): ProductGallerySwipeDirection | null {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const horizontalDistance = Math.abs(deltaX);

  if (
    horizontalDistance < MINIMUM_SWIPE_DISTANCE
    || horizontalDistance < Math.abs(deltaY) * HORIZONTAL_DOMINANCE_RATIO
  ) {
    return null;
  }

  return deltaX < 0 ? "next" : "previous";
}
