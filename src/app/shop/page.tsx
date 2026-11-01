import { Suspense } from "react";
import { ShopBrowser } from "@/components/ShopBrowser";
import { getStorefrontProducts } from "@/lib/catalogue";

export const metadata = {
  title: "Shop all pieces",
  description:
    "Explore the published catalogue of textiles and distinctive handmade pieces from Desert Art Gallery.",
};

function ShopBrowserFallback() {
  return (
    <div className="empty-note" role="status" aria-live="polite">
      Loading the published catalogue…
    </div>
  );
}

export default async function ShopPage() {
  const products = await getStorefrontProducts();

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div className="section-kicker">THE COLLECTION</div>
        <h1>Shop all pieces</h1>
        <p>
          Browse published pieces and use the filters to find relevant details.
          Product information is shown only when it has been supplied and
          approved for publication.
        </p>
      </div>
      <Suspense fallback={<ShopBrowserFallback />}>
        <ShopBrowser products={products} />
      </Suspense>
    </div>
  );
}
