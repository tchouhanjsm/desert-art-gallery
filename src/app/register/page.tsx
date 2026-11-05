import Link from "next/link";
import { isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";
import { CustomerRegisterForm } from "./customer-register-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account", description: "Create a Desert Art Gallery customer account." };

export default function RegisterPage() {
  if (!isMySqlCustomerAuthEnabled()) {
    return <section className="page-shell"><div className="page-heading"><div className="section-kicker">CUSTOMER ACCOUNT</div><h1>Create account</h1><p>New customer registration is not available in this environment.</p></div><Link className="text-link" href="/login">Back to sign in</Link></section>;
  }
  return <CustomerRegisterForm />;
}
