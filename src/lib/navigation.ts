export type NavigationItem = {
  href: string;
  label: string;
};

type NavigationSection = {
  title: string;
  links: NavigationItem[];
};

/** Customer-facing English navigation. Keep destinations real and implemented. */
export const primaryNavigation: NavigationItem[] = [
  { href: "/shop", label: "Shop all" },
  { href: "/artisans", label: "Makers" },
  { href: "/story", label: "Our story" },
  { href: "/journal", label: "Journal" },
  { href: "/contact", label: "Contact" },
];

export const footerNavigation: NavigationSection[] = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "Shop all" },
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
    title: "Customer care",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/account", label: "My account" },
    ],
  },
  {
    title: "Shopping information",
    links: [
      { href: "/shipping", label: "Shipping information" },
      { href: "/returns", label: "Returns and exchanges" },
      { href: "/faq", label: "Frequently asked questions" },
      { href: "/tracking", label: "Order tracking" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/privacy", label: "Privacy policy (draft)" },
      { href: "/terms", label: "Terms of service (draft)" },
    ],
  },
];
