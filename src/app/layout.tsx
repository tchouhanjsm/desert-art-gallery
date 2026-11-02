import type { Metadata } from "next";
import "@fontsource-variable/cormorant-garamond";
import "@fontsource-variable/dm-sans";
import "./globals.css";
import "@/styles/theme.css";
import "@/styles/admin-theme.css";
import "@/styles/editorial.css";
import { SiteChrome } from "@/components/SiteChrome";
import { CartProvider } from "@/components/CartProvider";
import { WishlistProvider } from "@/components/WishlistProvider";
import { getSiteUrl } from "@/lib/site-url";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <WishlistProvider>
            <SiteChrome>{children}</SiteChrome>
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
