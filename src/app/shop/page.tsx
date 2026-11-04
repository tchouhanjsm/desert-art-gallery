import { Suspense } from "react";
import { ShopBrowser } from "@/components/ShopBrowser";
import { getStorefrontProducts } from "@/lib/catalogue";

export const metadata = {
  title: "商品一覧",
  description: "Desert Art Galleryのオンラインストアに掲載中の商品をご覧いただけます。",
};

function ShopBrowserFallback() {
  return (
    <div className="atelier-empty-catalogue" role="status" aria-live="polite">
      商品情報を読み込んでいます…
    </div>
  );
}

export default async function ShopPage() {
  const products = await getStorefrontProducts();
  return (
    <div className="page-shell atelier-page-shell">
      <header className="atelier-page-heading">
        <div className="section-kicker">Desert Art Gallery · オンラインストア</div>
        <h1>商品一覧</h1>
        <p>現在オンラインストアでご覧いただける商品です。掲載情報や仕様について確認したい点がございましたら、商品ごとにお問い合わせください。</p>
        <div className="atelier-heading-meta">
          <span>商品一覧</span>
          <span>{products.length.toLocaleString("ja-JP")}件掲載中</span>
        </div>
      </header>
      <Suspense fallback={<ShopBrowserFallback />}>
        <ShopBrowser products={products} />
      </Suspense>
    </div>
  );
}
