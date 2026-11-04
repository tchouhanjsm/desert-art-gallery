import { WishlistPageClient } from "@/components/WishlistPageClient";
export const metadata = { title: "Wishlist", description: "Save pieces you would like to revisit." };
export default function WishlistPage() {
  return <div className="page-shell"><div className="page-heading"><div className="section-kicker">WISHLIST</div><h1>Your wishlist</h1><p>Keep the pieces you love together in one place.</p></div><WishlistPageClient /></div>;
}