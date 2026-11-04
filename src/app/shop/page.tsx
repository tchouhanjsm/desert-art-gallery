import { Suspense } from "react";
import { ShopBrowser } from "@/components/ShopBrowser";
import { getStorefrontProducts } from "@/lib/catalogue";

export const metadata = {
  title: "Shop all products",
  description: "Browse the products currently listed by Desert Art Gallery.",
};

function ShopBrowserFallback() {
  return (
    <div className="atelier-empty-catalogue" role="status" aria-live="polite">
      Loading products…
    </div>
  );
}

export default async function ShopPage() {
  const products = await getStorefrontProducts();
  return (
    <div className="page-shell atelier-page-shell">
      <header className="atelier-page-heading">
        <div className="section-kicker">DESERT ART GALLERY · ONLINE SHOP</div>
        <h1>Shop all products</h1>
        <p>Explore the pieces currently available in our online collection. Contact the gallery with questions about product details or specifications.</p>
        <div className="atelier-heading-meta">
          <span>Shop all products</span>
          <span>{products.length.toLocaleString("en-IN")}products listed</span>
        </div>
      </header>
      <Suspense fallback={<ShopBrowserFallback />}>
        <ShopBrowser products={products} />
      </Suspense>
    </div>
  );
}
