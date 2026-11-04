import { WishlistPageClient } from "@/components/WishlistPageClient";
export const metadata = { title: "Wishlist", description: "Save pieces you would like to revisit." };
export default function WishlistPage() {
  return <div className="page-shell"><div className="page-heading"><div className="section-kicker">WISHLIST</div><h1>Saved pieces</h1><p>Keep the pieces you like in one place.</p></div><WishlistPageClient /></div>;
}