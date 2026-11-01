import { CartPageClient } from "@/components/CartPageClient";
export const metadata = { title: "Shopping bag", description: "Review your selected Desert Art Gallery pieces." };
export default function CartPage() {
  return <div className="page-shell">
    <div className="page-heading"><div className="section-kicker">YOUR SELECTION</div><h1>Your shopping bag</h1><p>Review current availability and product details before placing an order.</p></div>
    <CartPageClient />
  </div>;
}