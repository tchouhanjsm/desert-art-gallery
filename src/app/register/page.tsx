import Link from "next/link";
import { isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";
import { CustomerRegisterForm } from "./customer-register-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create an account" };

export default function RegisterPage() {
  if (!isMySqlCustomerAuthEnabled()) {
    return <section className="page-shell"><div className="page-heading"><div className="section-kicker">CUSTOMER ACCOUNT</div><h1>Account registration</h1><p>Customer registration is not enabled on this environment.</p></div><Link className="text-link" href="/login">RETURN TO SIGN IN</Link></section>;
  }
  return <CustomerRegisterForm />;
}
