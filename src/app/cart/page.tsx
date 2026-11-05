import { CartPageClient } from "@/components/CartPageClient";
import { StorefrontPageHeading } from "@/components/StorefrontPageHeading";
export const metadata = { title: "Shopping bag", description: "Review the items in your bag." };
export default function CartPage() {
  return <div className="page-shell">
    <StorefrontPageHeading eyebrow="YOUR BAG" title="Shopping bag" description="Review item details and availability before proceeding to checkout." className="page-heading" />
    <CartPageClient />
  </div>;
}