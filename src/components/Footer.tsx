import Link from "next/link";
import { footerNavigation } from "@/lib/navigation";

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link href="/" className="footer-mark">DESERT ART GALLERY</Link>
          <p>A textile-led gallery based in Jaisalmer, Rajasthan.</p>
          <span>JAISALMER · RAJASTHAN · INDIA</span>
        </div>
        {footerNavigation.map((section) => (
          <nav aria-label={section.title} key={section.title}>
            <h4>{section.title.toUpperCase()}</h4>
            {section.links.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
          </nav>
        ))}
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} DESERT ART GALLERY</span>
        <span>BASED IN JAISALMER, RAJASTHAN</span>
        <a className="footer-email" href="mailto:hello@desertartgallery.net">EMAIL THE GALLERY</a>
      </div>
    </footer>
  );
}
