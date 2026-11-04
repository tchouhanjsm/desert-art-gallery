import { isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";
import { LegacyLoginForm } from "./legacy-login-form";
import { CustomerLoginForm } from "./customer-login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "ログイン", description: "Desert Art Galleryのお客様ログイン。" };

export default function LoginPage() {
  return isMySqlCustomerAuthEnabled() ? <CustomerLoginForm /> : <LegacyLoginForm />;
}
