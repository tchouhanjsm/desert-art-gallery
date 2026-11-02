"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings2,
  ShoppingBag,
  Users,
  X,
  Images,
} from "lucide-react";
import { signOutLocalOwner } from "@/app/owner/login/actions";

const navigation = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, section: "WORKSPACE" },
  { label: "Products", href: "/admin/products", icon: Package, section: "WORKSPACE" },
  { label: "Media library", href: "/admin/media", icon: Images, section: "WORKSPACE" },
  { label: "Website content", href: "/admin/content", icon: BookOpen, section: "WORKSPACE" },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag, section: "OPERATIONS" },
  { label: "Customers", href: "/admin/customers", icon: Users, section: "OPERATIONS" },
  { label: "Shipping & tax", href: "/admin/checkout", icon: Settings2, section: "SETTINGS" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = navigation.find((item) =>
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname === item.href || pathname.startsWith(item.href + "/"),
  );
  const pageTitle = active?.label ?? "Owner workspace";

  return (
    <div className="owner-app">
      {mobileOpen && (
        <button
          className="owner-sidebar-overlay"
          type="button"
          aria-label="Close owner navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={mobileOpen ? "owner-sidebar is-open" : "owner-sidebar"}>
        <Link className="owner-brand" href="/admin" onClick={() => setMobileOpen(false)}>
          <span className="owner-brand-monogram">D</span>
          <span><strong>DESERT ART GALLERY</strong><small>OWNER WORKSPACE</small></span>
        </Link>

        <div className="owner-workspace-card">
          <span>BUSINESS WORKSPACE</span>
          <strong>Desert Art Gallery</strong>
          <small>Jaisalmer · Rajasthan</small>
        </div>

        <nav className="owner-navigation" aria-label="Owner workspace">
          {(["WORKSPACE", "OPERATIONS", "SETTINGS"] as const).map((section) => (
            <div className="owner-navigation-section" key={section}>
              <span className="owner-navigation-label">{section}</span>
              {navigation.filter((item) => item.section === section).map((item) => {
                const Icon = item.icon;
                const selected = active?.href === item.href;
                return (
                  <Link
                    className={selected ? "owner-nav-link is-active" : "owner-nav-link"}
                    href={item.href}
                    key={item.href}
                    aria-current={selected ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span>{item.label}</span>
                    {selected && <ChevronRight size={15} className="owner-nav-current" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="owner-sidebar-bottom">
          <Link href="/" className="owner-storefront-link">
            <ArrowUpRight size={15} /> View public storefront
          </Link>
          <form action={signOutLocalOwner}>
            <button className="owner-signout" type="submit"><LogOut size={16} /> Sign out</button>
          </form>
        </div>
      </aside>

      <div className="owner-main">
        <header className="owner-topbar">
          <button
            className="owner-mobile-menu"
            type="button"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="owner-topbar-context">
            <span>GALLERY OPERATIONS</span>
            <strong>{pageTitle}</strong>
          </div>
          <div className="owner-topbar-actions">
            <span className="owner-topbar-status"><i /> Workspace</span>
            <Link href="/" target="_blank" rel="noreferrer" aria-label="Open public storefront"><ArrowUpRight size={17} /></Link>
          </div>
        </header>
        <div className="owner-content">{children}</div>
      </div>
    </div>
  );
}
