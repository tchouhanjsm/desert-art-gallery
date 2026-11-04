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
          <Link href="/" className="footer-mark">DESERT ART GALLERY</Link>
          <p>ラージャスターン州ジャイサルメールから、テキスタイルと手仕事の品をご紹介します。</p>
          <span>ジャイサルメール · ラージャスターン州 · インド</span>
        </div>
        {footerNavigation.map((section) => (
          <nav aria-label={section.title} key={section.title}>
            <h2>{section.title}</h2>
            {section.links.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
          </nav>
        ))}
      </div>
      <div className="jp-footer-bottom">
        <span>© {new Date().getFullYear()} DESERT ART GALLERY</span>
        <span>商品・配送・ご注文に関するお問い合わせはお問い合わせページよりご連絡ください。</span>
        <Link href="/contact">お問い合わせ</Link>
      </div>
    </footer>
  );
}
