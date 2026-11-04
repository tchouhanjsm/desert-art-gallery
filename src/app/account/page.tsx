import { isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";
import { LegacyAccountPage } from "./legacy-page";
import { CustomerAccountPage } from "./customer-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "My account", robots: { index: false, follow: false } };

export default function AccountPage() {
  return isMySqlCustomerAuthEnabled() ? <CustomerAccountPage /> : <LegacyAccountPage />;
}
