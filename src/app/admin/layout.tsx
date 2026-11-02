import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getCurrentLocalAdmin } from "@/server/auth/local-admin";
import { isMySqlCatalogueEnabled } from "@/server/db";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (isMySqlCatalogueEnabled()) {
    const admin = await getCurrentLocalAdmin();
    if (!admin) redirect("/owner/login?next=/admin");
  }
  return <AdminShell>{children}</AdminShell>;
}
