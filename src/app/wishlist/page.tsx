import { WishlistPageClient } from "@/components/WishlistPageClient";
export const metadata = { title: "Wishlist", description: "Keep your favourite Desert Art Gallery pieces together." };
export default function WishlistPage() {
  return <div className="page-shell"><div className="page-heading"><div className="section-kicker">SAVED PIECES</div><h1>Your wishlist</h1><p>Keep the pieces that have caught your eye close by.</p></div><WishlistPageClient /></div>;
}