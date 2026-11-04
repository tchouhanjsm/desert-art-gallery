import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "@/styles/theme.css";
import "@/styles/admin-theme.css";
import "@/styles/editorial.css";
import "@/styles/phase1.css";
import { SiteChrome } from "@/components/SiteChrome";
import { CartProvider } from "@/components/CartProvider";
import { WishlistProvider } from "@/components/WishlistProvider";
import { getSiteUrl } from "@/lib/site-url";
import { getStorefrontCollections } from "@/lib/catalogue";

const playfair = localFont({
  src: "../../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2",
  weight: "400 900",
  style: "normal",
  variable: "--font-display",
  display: "swap",
  preload: true,
});

const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-body",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Desert Art Gallery — Textiles, Objects & Stories",
    template: "%s | Desert Art Gallery",
  },
  description: "A considered gallery of textiles and objects based in Jaisalmer, Rajasthan. Explore published pieces, collections and stories.",
  openGraph: {
    type: "website",
    title: "Desert Art Gallery",
    description: "A considered gallery of textiles and objects based in Jaisalmer, Rajasthan.",
    siteName: "Desert Art Gallery",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const menuCollections = await getStorefrontCollections()
    .then((items) => items.slice(0, 6).map((item) => ({ slug: item.slug, name: item.name })))
    .catch(() => []);
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${inter.variable}`}>
        <CartProvider>
          <WishlistProvider>
            <SiteChrome collections={menuCollections}>{children}</SiteChrome>
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
