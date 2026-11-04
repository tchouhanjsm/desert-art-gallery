import type { Metadata } from "next";
import "./globals.css";
import "@/styles/japan-storefront.css";
import "@/styles/admin-theme.css";
import { SiteChrome } from "@/components/SiteChrome";
import { CartProvider } from "@/components/CartProvider";
import { WishlistProvider } from "@/components/WishlistProvider";
import { getSiteUrl } from "@/lib/site-url";
import { getStorefrontCollections } from "@/lib/catalogue";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Desert Art Gallery | Textiles and Handcrafted Pieces from Rajasthan",
    template: "%s | Desert Art Gallery",
  },
  description: "Based in Jaisalmer, Rajasthan, India, Desert Art Gallery presents textiles and handcrafted pieces with care for their materials, character and verified details.",
  openGraph: {
    type: "website",
    title: "Desert Art Gallery",
    description: "A considered collection of textiles and handcrafted pieces from Rajasthan.",
    siteName: "Desert Art Gallery",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const menuCollections = await getStorefrontCollections()
    .then((items) => items.slice(0, 8).map((item) => ({ slug: item.slug, name: item.name })))
    .catch(() => []);
  return (
    <html lang="en">
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
