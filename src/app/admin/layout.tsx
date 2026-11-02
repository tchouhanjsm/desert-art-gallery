import Link from "next/link";
import type { ReactNode } from "react";
import { AdminNavigation } from "@/components/AdminNavigation";
import "@/styles/admin.css";

export const metadata = {
  title: {
    default: "Owner workspace",
    template: "%s | Desert Art Gallery",
  },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="owner-app">
      <aside className="owner-sidebar">
        <Link className="owner-brand" href="/admin" aria-label="Desert Art Gallery owner workspace">
          <span className="owner-brand-mark">DAG</span>
          <span className="owner-brand-copy">
            <strong>DESERT ART GALLERY</strong>
            <small>OWNER WORKSPACE</small>
          </span>
        </Link>
        <AdminNavigation />
        <div className="owner-sidebar-note">
          <span className="owner-sidebar-note-mark" aria-hidden="true">✳</span>
          <strong>Your gallery, in your hands.</strong>
          <p>Manage the catalogue and the stories presented to your customers.</p>
        </div>
      </aside>
      <div className="owner-main">
        <header className="owner-topbar">
          <div>
            <span className="owner-topbar-kicker">DESERT ART GALLERY</span>
            <strong>Owner operations</strong>
          </div>
          <div className="owner-topbar-actions">
            <span className="owner-environment"><i /> Workspace</span>
            <Link href="/" target="_blank" rel="noreferrer">View live site ↗</Link>
          </div>
        </header>
        <div className="owner-mobile-nav"><AdminNavigation /></div>
        <main className="owner-content">{children}</main>
        <footer className="owner-footer">
          <span>DESERT ART GALLERY · OWNER WORKSPACE</span>
          <span>Changes to published content are visible on the storefront.</span>
        </footer>
      </div>
    </div>
  );
}
