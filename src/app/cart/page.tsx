import { CartPageClient } from "@/components/CartPageClient";
export const metadata = { title: "Shopping bag", description: "Review the items in your bag." };
export default function CartPage() {
  return <div className="page-shell">
    <div className="page-heading"><div className="section-kicker">YOUR BAG</div><h1>Shopping bag</h1><p>Review item details and availability before proceeding to checkout.</p></div>
    <CartPageClient />
  </div>;
}