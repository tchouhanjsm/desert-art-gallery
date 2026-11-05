export type NavigationItem = {
  href: string;
  label: string;
};

type NavigationSection = {
  title: string;
  links: NavigationItem[];
};

/** Customer-facing Japanese-first navigation. Keep destinations real and implemented. */
export const primaryNavigation: NavigationItem[] = [
  { href: "/shop", label: "All products" },
  { href: "/artisans", label: "Makers" },
  { href: "/story", label: "Our story" },
  { href: "/journal", label: "Journal" },
  { href: "/contact", label: "Contact" },
];

export const footerNavigation: NavigationSection[] = [
  {
    title: "SHOP",
    links: [
      { href: "/shop", label: "All products" },
      { href: "/cart", label: "View cart" },
    ],
  },
  {
    title: "Desert Art Gallery",
    links: [
      { href: "/story", label: "About the gallery" },
      { href: "/artisans", label: "Makers" },
      { href: "/journal", label: "Journal" },
    ],
  },
  {
    title: "SUPPORT",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/account", label: "My account" },
    ],
  },
  {
    title: "CUSTOMER GUIDE",
    links: [
      { href: "/shipping", label: "Shipping information" },
      { href: "/returns", label: "Returns & exchanges" },
      { href: "/faq", label: "FAQs" },
      { href: "/tracking", label: "Track an order" },
    ],
  },
  {
    title: "POLICIES",
    links: [
      { href: "/privacy", label: "Privacy notice (draft)" },
      { href: "/terms", label: "Terms of use (draft)" },
    ],
  },
];
