"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { footerNavigation } from "@/lib/navigation";

export function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || pathname.startsWith("/owner")) return null;

  return (
    <footer className="footer jp-footer">
      <div className="jp-footer-main">
        <div className="jp-footer-brand">
          <Link href="/" prefetch={false} className="footer-mark">DESERT ART GALLERY</Link>
          <p>Textiles and handmade pieces, shared from Jaisalmer, Rajasthan, India.</p>
          <span>JAISALMER · RAJASTHAN · INDIA</span>
        </div>
        {footerNavigation.map((section) => (
          <nav aria-label={section.title} key={section.title}>
            <h2>{section.title}</h2>
            {section.links.map((item) => <Link href={item.href} prefetch={false} key={item.href}>{item.label}</Link>)}
          </nav>
        ))}
      </div>
      <div className="jp-footer-bottom">
        <span>© {new Date().getFullYear()} DESERT ART GALLERY</span>
        <span>For questions about products, delivery or orders, please use our contact page.</span>
        <Link href="/contact" prefetch={false}>Contact us</Link>
      </div>
    </footer>
  );
}
