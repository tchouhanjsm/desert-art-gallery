"use client";
import { Heart } from "lucide-react";
import { useWishlist } from "@/components/WishlistProvider";

export function WishlistToggle({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(slug);

  return (
    <button
      className={compact ? "wishlist-toggle wishlist-toggle--compact" : "wishlist-toggle"}
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "お気に入りから削除" : "お気に入りに追加"}
      title={saved ? "Remove from wishlist" : "Add to wishlist"}
      onClick={() => toggle(slug)}
    >
      <Heart size={compact ? 17 : 18} fill={saved ? "currentColor" : "none"} />
      {compact
        ? <span className="visually-hidden">{saved ? "お気に入りに保存済み" : "Add to wishlist"}</span>
        : <span>{saved ? "お気に入りに保存済み" : "お気に入りに追加"}</span>}
    </button>
  );
}
