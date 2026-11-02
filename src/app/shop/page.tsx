import { Suspense } from "react";
import { ShopBrowser } from "@/components/ShopBrowser";
import { getStorefrontProducts } from "@/lib/catalogue";

export const metadata = {
  title: "Shop the collection",
  description:
    "Explore published textiles and objects from Desert Art Gallery in Jaisalmer, Rajasthan.",
};

function ShopBrowserFallback() {
  return (
    <div className="atelier-empty-catalogue" role="status" aria-live="polite">
      Preparing the gallery catalogue…
    </div>
  );
}

export default async function ShopPage() {
  const products = await getStorefrontProducts();

  return (
    <div className="page-shell atelier-page-shell">
      <header className="atelier-page-heading">
        <div className="section-kicker">THE ONLINE GALLERY · JAISALMER</div>
        <h1>Objects to <em>live with.</em></h1>
        <p>Explore the pieces currently published by the gallery. Each listing shows the details available for that piece; contact us where you need further information.</p>
        <div className="atelier-heading-meta">
          <span>TEXTILES & OBJECTS</span>
          <span>{products.length} {products.length === 1 ? "PUBLISHED PIECE" : "PUBLISHED PIECES"}</span>
        </div>
      </header>
      <Suspense fallback={<ShopBrowserFallback />}>
        <ShopBrowser products={products} />
      </Suspense>
    </div>
  );
}
