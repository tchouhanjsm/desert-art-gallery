import type { Metadata } from "next";
import "@fontsource-variable/cormorant-garamond";
import "@fontsource-variable/dm-sans";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartProvider } from "@/components/CartProvider";
import { WishlistProvider } from "@/components/WishlistProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://desertartgallery.net"),
  title: {
    default: "Desert Art Gallery — Textiles, Objects & Stories",
    template: "%s | Desert Art Gallery",
  },
  description: "A textile-led gallery based in Jaisalmer, Rajasthan. Explore published pieces, editorial stories and gallery enquiries.",
  openGraph: {
    type: "website",
    title: "Desert Art Gallery",
    description: "A textile-led gallery based in Jaisalmer, Rajasthan.",
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
            <Header />
            <main id="main-content" tabIndex={-1}>{children}</main>
            <Footer />
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
