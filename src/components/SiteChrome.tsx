"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isOwnerWorkspace = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isOwnerWorkspace) return children;

  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
