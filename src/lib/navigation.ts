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
  { href: "/shop", label: "すべての商品" },
  { href: "/artisans", label: "つくり手" },
  { href: "/story", label: "ブランドについて" },
  { href: "/journal", label: "読みもの" },
  { href: "/contact", label: "お問い合わせ" },
];

export const footerNavigation: NavigationSection[] = [
  {
    title: "お買いもの",
    links: [
      { href: "/shop", label: "すべての商品" },
      { href: "/cart", label: "カートを見る" },
    ],
  },
  {
    title: "Desert Art Gallery",
    links: [
      { href: "/story", label: "私たちについて" },
      { href: "/artisans", label: "つくり手" },
      { href: "/journal", label: "読みもの" },
    ],
  },
  {
    title: "サポート",
    links: [
      { href: "/contact", label: "お問い合わせ" },
      { href: "/account", label: "マイページ" },
    ],
  },
];
