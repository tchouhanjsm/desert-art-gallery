import type { Metadata } from "next";
import "./globals.css";
import "@/styles/admin-theme.css";
import "@/styles/japan-storefront.css";
import { SiteChrome } from "@/components/SiteChrome";
import { CartProvider } from "@/components/CartProvider";
import { WishlistProvider } from "@/components/WishlistProvider";
import { getSiteUrl } from "@/lib/site-url";
import { getStorefrontCollections } from "@/lib/catalogue";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Desert Art Gallery｜ラージャスターンのテキスタイルと手仕事",
    template: "%s｜Desert Art Gallery",
  },
  description: "インド・ラージャスターン州ジャイサルメールを拠点に、テキスタイルや手仕事の品をご紹介するオンラインストアです。",
  openGraph: {
    type: "website",
    title: "Desert Art Gallery",
    description: "ラージャスターンのテキスタイルと手仕事の品を紹介するオンラインストア。",
    siteName: "Desert Art Gallery",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const menuCollections = await getStorefrontCollections()
    .then((items) => items.slice(0, 8).map((item) => ({ slug: item.slug, name: item.name })))
    .catch(() => []);
  return (
    <html lang="ja">
      <body>
        <CartProvider>
          <WishlistProvider>
            <SiteChrome collections={menuCollections}>{children}</SiteChrome>
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
