import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartProvider } from "@/components/CartProvider";
import { WishlistProvider } from "@/components/WishlistProvider";

const serif = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-display", weight: ["400", "500", "600"] });
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600", "700"] });

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
      <body className={serif.variable + " " + sans.variable}>
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
