"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export function SiteChrome({ children, collections = [] }: { children: ReactNode; collections?: { slug: string; name: string }[] }) {
  const pathname = usePathname();
  const isOwnerWorkspace = pathname === "/admin" || pathname.startsWith("/admin/");
  if (isOwnerWorkspace) return children;

  return (
    <>
      <Header collections={collections} />
      <main id="main-content" tabIndex={-1}>{children}</main>
      <Footer />
    </>
  );
}
