export type NavigationItem = {
  href: string;
  label: string;
};

export const primaryNavigation: NavigationItem[] = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/story", label: "Our story" },
  { href: "/artisans", label: "Makers" },
  { href: "/journal", label: "Journal" },
  { href: "/contact", label: "Contact" },
];

export const footerNavigation = [
  {
    title: "Explore",
    links: [
      { href: "/shop", label: "Shop the gallery" },
      { href: "/story", label: "Our approach" },
    ],
  },
  {
    title: "The gallery",
    links: [
      { href: "/artisans", label: "Makers" },
      { href: "/journal", label: "Journal" },
      { href: "/contact", label: "Contact" },
    ],
  },
] as const;
