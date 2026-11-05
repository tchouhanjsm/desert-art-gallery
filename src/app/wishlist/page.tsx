import { WishlistPageClient } from "@/components/WishlistPageClient";
import { StorefrontPageHeading } from "@/components/StorefrontPageHeading";
export const metadata = { title: "Wishlist", description: "Save pieces you would like to revisit." };
export default function WishlistPage() {
  return <div className="page-shell"><StorefrontPageHeading eyebrow="WISHLIST" title="Your wishlist" description="Keep the pieces you love together in one place." className="page-heading" /><WishlistPageClient /></div>;
}