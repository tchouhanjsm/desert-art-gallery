"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoneyFromMinor } from "@/lib/money";
import { useWishlist } from "@/components/WishlistProvider";

type PreviewItem = { slug: string; name: string; quantityRequested: number; availableQuantity: number; available: boolean; priceMinor: number | null; currency: string | null; image: string | null; imageAlt: string };

export function WishlistPageClient() {
  const { slugs, remove } = useWishlist();
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slugs.length) { setItems([]); return; }
      setLoading(true);
      try {
        const response = await fetch("/api/cart/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: slugs.map((slug) => ({ slug, quantity: 1 })) }), cache: "no-store" });
        const data = await response.json();
        if (!cancelled && response.ok) setItems(Array.isArray(data.items) ? data.items : []);
      } catch { if (!cancelled) setItems([]); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [slugs]);
  if (!slugs.length) return <div className="empty-note">Your wishlist is ready for its first discovery.<br/><Link href="/shop" className="empty-link">EXPLORE THE COLLECTION ↗</Link></div>;
  return <div>
    {loading && <p className="cart-state">Refreshing saved pieces…</p>}
    <div className="wishlist-grid">{items.map((item) => <article className="wishlist-card" key={item.slug}>
      <Link href={"/products/" + item.slug}>
        {item.image ? <Image src={item.image} alt={item.imageAlt} width={500} height={620} unoptimized /> : <div className="wishlist-placeholder" />}
        <div className="product-category">DESERT ART GALLERY</div><h2>{item.name}</h2>
        <p>{item.priceMinor !== null && item.currency ? formatMoneyFromMinor(item.priceMinor, item.currency) : "Price on enquiry"}</p>
      </Link>
      {!item.available && <small className="cart-error">Currently unavailable</small>}
      <button className="wishlist-remove" type="button" onClick={() => remove(item.slug)}>REMOVE FROM WISHLIST</button>
    </article>)}</div>
    <div className="center-action"><Link href="/shop" className="button-outline">CONTINUE DISCOVERING</Link></div>
  </div>;
}
