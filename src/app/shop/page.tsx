import { Suspense } from "react";
import { ShopBrowser } from "@/components/ShopBrowser";
import { getStorefrontProducts } from "@/lib/catalogue";

export const metadata = {
  title: "All products",
  description: "Explore the pieces currently published in the Desert Art Gallery online store.",
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
        <div className="section-kicker">DESERT ART GALLERY · ONLINE STORE</div>
        <h1>All products</h1>
        <p>Explore the pieces currently available in our online catalogue. Contact us with any questions about a listing, materials or specifications.</p>
      </header>
      <Suspense fallback={<ShopBrowserFallback />}>
        <ShopBrowser products={products} />
      </Suspense>
    </div>
  );
}
