import { isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";
import { LegacyLoginForm } from "./legacy-login-form";
import { CustomerLoginForm } from "./customer-login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in", description: "Sign in to your Desert Art Gallery account." };

export default function LoginPage() {
  return isMySqlCustomerAuthEnabled() ? <CustomerLoginForm /> : <LegacyLoginForm />;
}
