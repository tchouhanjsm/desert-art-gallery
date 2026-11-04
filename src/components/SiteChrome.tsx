"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export function SiteChrome({ children, collections = [] }: { children: ReactNode; collections?: { slug: string; name: string }[] }) {
  const pathname = usePathname();
  const isOperationsWorkspace = pathname.startsWith("/admin") || pathname.startsWith("/owner");

  // Keep the customer shell and its theme completely outside owner/admin routes.
  if (isOperationsWorkspace) return children;

  return (
    <div className="jp-storefront">
      <Header collections={collections} />
      <main id="main-content" tabIndex={-1}>{children}</main>
      <Footer />
    </div>
  );
}
