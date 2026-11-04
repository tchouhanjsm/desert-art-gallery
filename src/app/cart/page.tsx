import { CartPageClient } from "@/components/CartPageClient";
export const metadata = { title: "Your cart", description: "Review the pieces you have added to your cart." };
export default function CartPage() {
  return <div className="page-shell">
    <div className="page-heading"><div className="section-kicker">YOUR BAG</div><h1>Your cart</h1><p>Review the items and check availability before proceeding to checkout.</p></div>
    <CartPageClient />
  </div>;
}