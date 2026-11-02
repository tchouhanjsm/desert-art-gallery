"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Images,
  ShoppingBag,
  Users,
  PanelsTopLeft,
  Truck,
  ExternalLink,
} from "lucide-react";

const items = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/media", label: "Media library", icon: Images },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/content", label: "Site content", icon: PanelsTopLeft },
  { href: "/admin/checkout", label: "Shipping & tax", icon: Truck },
];

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="owner-nav" aria-label="Owner workspace">
      <span className="owner-nav-label">WORKSPACE</span>
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            className={active ? "owner-nav-link is-active" : "owner-nav-link"}
            href={href}
            key={href}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
      <span className="owner-nav-divider" />
      <Link className="owner-nav-link owner-nav-store-link" href="/" target="_blank" rel="noreferrer">
        <ExternalLink size={16} strokeWidth={1.7} aria-hidden="true" />
        <span>View storefront</span>
      </Link>
    </nav>
  );
}
