"use client";
import { Heart } from "lucide-react";
import { useWishlist } from "@/components/WishlistProvider";
export function WishlistToggle({ slug }: { slug: string }) {
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(slug);
  return <button className="wishlist-toggle" type="button" aria-pressed={saved} aria-label={saved ? "Remove from wishlist" : "Add to wishlist"} onClick={() => toggle(slug)}>
    <Heart size={18} fill={saved ? "currentColor" : "none"} />
    <span>{saved ? "SAVED TO WISHLIST" : "ADD TO WISHLIST"}</span>
  </button>;
}
