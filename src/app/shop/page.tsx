import { getStorefrontProducts } from "@/lib/catalogue";
import { ShopBrowser } from "@/components/ShopBrowser";

export const metadata = { title: "Shop all pieces", description: "Explore heritage textiles and distinctive handmade pieces from Desert Art Gallery." };

export default async function ShopPage() {
  const products = await getStorefrontProducts();
  return <div className="page-shell">
    <div className="page-heading"><div className="section-kicker">THE COLLECTION</div><h1>Shop all pieces</h1><p>A considered edit of heritage textiles and distinctive handmade work.</p></div>
    <ShopBrowser products={products} />
  </div>;
}
